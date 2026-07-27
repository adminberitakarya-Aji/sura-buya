'use client';

import { useEffect, useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@suro-buya/ui';
import type { AIConfigSummary, AITask } from '@/lib/api-client';

export const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'custom', label: 'Lainnya' },
];

export const TASK_LABELS: Record<AITask, string> = {
  CREATIVE_GENERATION: 'Generasi Kreatif',
  PLANNING: 'Perencanaan Episode/Season',
  VALIDATION: 'Validasi Canon',
  EMBEDDING: 'Embedding / Pencarian',
  IMAGE_PROMPT: 'Prompt Gambar',
  CODE_GENERATION: 'Generasi Kode',
};

export interface AIConfigFormValues {
  provider: string;
  model: string;
  apiKey: string; // '' means "leave unchanged" if editing, or "no key" if creating
  isDefault: boolean;
}

function toFormValues(config?: AIConfigSummary | null): AIConfigFormValues {
  return {
    provider: config?.provider ?? 'anthropic',
    model: config?.model ?? '',
    apiKey: '',
    isDefault: config?.isDefault ?? false,
  };
}

interface AIConfigFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: AITask;
  config?: AIConfigSummary | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (values: AIConfigFormValues) => void;
}

export function AIConfigFormDialog({
  open,
  onOpenChange,
  task,
  config,
  isSubmitting,
  error,
  onSubmit,
}: AIConfigFormDialogProps) {
  const [values, setValues] = useState<AIConfigFormValues>(() => toFormValues(config));

  useEffect(() => {
    if (open) setValues(toFormValues(config));
  }, [open, config]);

  function patch(p: Partial<AIConfigFormValues>) {
    setValues((prev) => ({ ...prev, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const canSubmit = values.provider.trim().length > 0 && values.model.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{TASK_LABELS[task]}</DialogTitle>
            <DialogDescription>
              Atur provider dan model AI yang dipakai khusus untuk task ini. Kosongkan untuk
              memakai pengaturan default universe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ac-provider">Provider</Label>
              <Select value={values.provider} onValueChange={(v) => patch({ provider: v })}>
                <SelectTrigger id="ac-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ac-model">Model</Label>
              <Input
                id="ac-model"
                value={values.model}
                onChange={(e) => patch({ model: e.target.value })}
                placeholder="mis. claude-3-5-sonnet-20241022"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ac-key">API Key</Label>
              <Input
                id="ac-key"
                type="password"
                value={values.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder={
                  config?.hasApiKey ? `Tersimpan: ${config.apiKeyMasked}` : 'sk-...'
                }
                autoComplete="off"
              />
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <KeyRound className="h-3 w-3" />
                Dienkripsi sebelum disimpan. Kosongkan untuk tidak mengubah key yang sudah ada.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.isDefault}
                onChange={(e) => patch({ isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Jadikan default untuk task ini
            </label>
          </div>

          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
