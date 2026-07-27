'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@suro-buya/ui';
import { aiConfigApi, type AIConfigSummary, type AITask } from '@/lib/api-client';
import {
  AIConfigFormDialog,
  TASK_LABELS,
  PROVIDER_OPTIONS,
  type AIConfigFormValues,
} from './ai-config-form-dialog';

const ALL_TASKS = Object.keys(TASK_LABELS) as AITask[];

export default function AIProvidersSettingsPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;
  const queryClient = useQueryClient();

  const [editingTask, setEditingTask] = useState<AITask | null>(null);
  const [taskToClear, setTaskToClear] = useState<AITask | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['aiConfigs', universeId],
    queryFn: () => aiConfigApi.list(universeId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['aiConfigs', universeId] });

  const upsertMutation = useMutation({
    mutationFn: ({ task, values }: { task: AITask; values: AIConfigFormValues }) =>
      aiConfigApi.upsert(universeId, task, {
        provider: values.provider,
        model: values.model,
        ...(values.apiKey !== '' ? { apiKey: values.apiKey } : {}),
        isDefault: values.isDefault,
      }),
    onSuccess: () => {
      invalidate();
      setEditingTask(null);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.');
    },
  });

  const clearMutation = useMutation({
    mutationFn: (task: AITask) => aiConfigApi.remove(universeId, task),
    onSuccess: () => {
      invalidate();
      setTaskToClear(null);
    },
  });

  const configByTask = new Map<AITask, AIConfigSummary>();
  for (const config of data?.configs ?? []) {
    configByTask.set(config.task, config);
  }

  return (
    <div>
      <Link
        href={`/${universeId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Universe
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Pengaturan AI Provider</h1>
        <p className="text-sm text-muted-foreground">
          Atur provider, model, dan API key khusus per task generasi. API key dienkripsi dan
          tidak pernah ditampilkan penuh setelah disimpan.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat konfigurasi...</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat konfigurasi AI provider. Coba muat ulang halaman.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {ALL_TASKS.map((task) => {
            const config = configByTask.get(task);
            return (
              <Card key={task}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{TASK_LABELS[task]}</span>
                      {config?.isDefault && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <CheckCircle2 className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {config ? (
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {PROVIDER_OPTIONS.find((p) => p.value === config.provider)?.label ??
                            config.provider}{' '}
                          — {config.model}
                        </span>
                        {config.hasApiKey && (
                          <span className="flex items-center gap-1 text-xs">
                            <KeyRound className="h-3 w-3" />
                            {config.apiKeyMasked}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Belum dikonfigurasi — memakai default universe.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormError(null);
                        setEditingTask(task);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      {config ? 'Edit' : 'Atur'}
                    </Button>
                    {config && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTaskToClear(task)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Hapus konfigurasi {TASK_LABELS[task]}</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editingTask && (
        <AIConfigFormDialog
          open={editingTask !== null}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
          config={configByTask.get(editingTask) ?? null}
          isSubmitting={upsertMutation.isPending}
          error={formError}
          onSubmit={(values) => upsertMutation.mutate({ task: editingTask, values })}
        />
      )}

      <Dialog open={taskToClear !== null} onOpenChange={(open) => !open && setTaskToClear(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus konfigurasi {taskToClear && TASK_LABELS[taskToClear]}?</DialogTitle>
            <DialogDescription>
              Task ini akan kembali memakai pengaturan default universe. API key yang tersimpan
              untuk task ini akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskToClear(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={clearMutation.isPending}
              onClick={() => taskToClear && clearMutation.mutate(taskToClear)}
            >
              {clearMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
