'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import type { BibleCategory } from '@/lib/api-client';

export const CATEGORY_OPTIONS: { value: BibleCategory; label: string }[] = [
  { value: 'CHARACTER', label: 'Character Bible' },
  { value: 'WORLD', label: 'World Bible' },
  { value: 'STORY', label: 'Story Bible' },
  { value: 'VISUAL', label: 'Visual Bible' },
  { value: 'PRODUCTION', label: 'Production Bible' },
];

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') + '.md'
  );
}

export interface CreateBibleFileValues {
  category: BibleCategory;
  path: string;
  title: string;
}

interface CreateBibleFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: BibleCategory;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (values: CreateBibleFileValues) => void;
}

export function CreateBibleFileDialog({
  open,
  onOpenChange,
  defaultCategory = 'CHARACTER',
  isSubmitting,
  error,
  onSubmit,
}: CreateBibleFileDialogProps) {
  const [category, setCategory] = useState<BibleCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ category, path, title });
  }

  const canSubmit = title.trim().length > 0 && /^[a-z0-9/-]+\.md$/.test(path);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTitle('');
          setPath('');
          setCategory(defaultCategory);
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Buat Bible File Baru</DialogTitle>
            <DialogDescription>
              Bible file baru bisa langsung ditulis dengan markdown dan frontmatter setelah
              dibuat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bf-category">Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as BibleCategory)}>
                <SelectTrigger id="bf-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bf-title">Judul</Label>
              <Input
                id="bf-title"
                value={title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  const shouldAutoSync = path === '' || path === slugify(title);
                  setTitle(newTitle);
                  if (shouldAutoSync) setPath(slugify(newTitle));
                }}
                placeholder="mis. Voice Guide: Suro"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bf-path">Path File</Label>
              <Input
                id="bf-path"
                value={path}
                onChange={(e) => setPath(e.target.value.toLowerCase())}
                placeholder="voice-guide-suro.md"
              />
              <p className="text-xs text-muted-foreground">
                Harus unik dalam kategori ini, huruf kecil, diakhiri .md
              </p>
            </div>
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
              Buat & Edit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
