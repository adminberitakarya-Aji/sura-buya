'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, FileText, Loader2, BookOpen } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@suro-buya/ui';
import { bibleApi, type BibleCategory, type BibleFileSummary } from '@/lib/api-client';
import { CreateBibleFileDialog, CATEGORY_OPTIONS, type CreateBibleFileValues } from './create-bible-file-dialog';

export default function BiblePage() {
  const params = useParams<{ universeId: string }>();
  const router = useRouter();
  const universeId = params.universeId;
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bibleFiles', universeId],
    queryFn: () => bibleApi.list(universeId),
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateBibleFileValues) =>
      bibleApi.create(universeId, {
        category: values.category,
        path: values.path,
        title: values.title,
        content: `# ${values.title}\n\nMulai tulis di sini...`,
      }),
    onSuccess: ({ bibleFile }) => {
      queryClient.invalidateQueries({ queryKey: ['bibleFiles', universeId] });
      setCreateOpen(false);
      setCreateError(null);
      router.push(`/${universeId}/bible/${bibleFile.id}`);
    },
    onError: (err: unknown) => {
      setCreateError(err instanceof Error ? err.message : 'Gagal membuat bible file.');
    },
  });

  const files = data?.bibleFiles ?? [];
  const grouped = groupByCategory(files);

  return (
    <div>
      <Link
        href={`/${universeId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Universe
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Universe Bible</h1>
          <p className="text-sm text-muted-foreground">
            Character, world, story, visual, dan production bible dalam satu tempat.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Bible File Baru
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat bible files...</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat bible files. Coba muat ulang halaman.
        </div>
      )}

      {!isLoading && !isError && files.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Belum ada bible file</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Buat file bible pertama untuk mulai mendokumentasikan universe ini.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Bible File Baru
          </Button>
        </div>
      )}

      {!isLoading && !isError && files.length > 0 && (
        <div className="space-y-8">
          {CATEGORY_OPTIONS.filter((c) => grouped[c.value]?.length).map((cat) => (
            <div key={cat.value}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {cat.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {grouped[cat.value].map((file) => (
                  <Link key={file.id} href={`/${universeId}/bible/${file.id}`}>
                    <Card className="h-full transition-colors hover:bg-accent">
                      <CardContent className="flex items-start gap-3 p-4">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{file.title}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{file.path}</span>
                            <Badge variant="secondary" className="shrink-0 font-normal">
                              v{file.version}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateBibleFileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isSubmitting={createMutation.isPending}
        error={createError}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </div>
  );
}

function groupByCategory(
  files: BibleFileSummary[]
): Record<BibleCategory, BibleFileSummary[]> {
  const result: Record<BibleCategory, BibleFileSummary[]> = {
    CHARACTER: [],
    WORLD: [],
    STORY: [],
    VISUAL: [],
    PRODUCTION: [],
  };
  for (const file of files) {
    result[file.category].push(file);
  }
  return result;
}
