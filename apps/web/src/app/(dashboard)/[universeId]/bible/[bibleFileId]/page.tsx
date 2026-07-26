'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  BibleEditor,
  stringifyBibleContent,
  parseBibleFile,
} from '@suro-buya/ui';
import { bibleApi } from '@/lib/api-client';

export default function BibleFileEditorPage() {
  const params = useParams<{ universeId: string; bibleFileId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { universeId, bibleFileId } = params;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bibleFile', universeId, bibleFileId],
    queryFn: () => bibleApi.get(universeId, bibleFileId),
  });

  const [title, setTitle] = useState('');
  const [rawValue, setRawValue] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState<{ title: string; raw: string } | null>(
    null
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Hydrate local editor state once the bible file loads. Runs once per
  // fetched file (guarded by savedSnapshot being null / a different file).
  useEffect(() => {
    if (!data) return;
    const { bibleFile } = data;
    const raw = stringifyBibleContent(bibleFile.frontmatter ?? {}, bibleFile.content);
    setTitle(bibleFile.title);
    setRawValue(raw);
    setSavedSnapshot({ title: bibleFile.title, raw });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.bibleFile.id, data?.bibleFile.version]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const { frontmatter, content } = parseBibleFile(rawValue);
      return bibleApi.update(universeId, bibleFileId, { title, content, frontmatter });
    },
    onSuccess: ({ bibleFile }) => {
      queryClient.invalidateQueries({ queryKey: ['bibleFile', universeId, bibleFileId] });
      queryClient.invalidateQueries({ queryKey: ['bibleFiles', universeId] });
      setSavedSnapshot({ title: bibleFile.title, raw: rawValue });
      setSaveError(null);
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => bibleApi.remove(universeId, bibleFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bibleFiles', universeId] });
      router.push(`/${universeId}/bible`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Memuat bible file...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Bible file tidak ditemukan, atau Anda tidak punya akses.
        <div className="mt-3">
          <Link href={`/${universeId}/bible`} className="underline">
            Kembali ke daftar bible
          </Link>
        </div>
      </div>
    );
  }

  const isDirty = savedSnapshot !== null && (savedSnapshot.title !== title || savedSnapshot.raw !== rawValue);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <Link
        href={`/${universeId}/bible`}
        className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Universe Bible
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-none px-0 text-xl font-bold shadow-none focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data.bibleFile.path}</span>
            <Badge variant="secondary" className="font-normal">
              v{data.bibleFile.version}
            </Badge>
            {isDirty && <Badge className="font-normal">Belum disimpan</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Hapus
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </div>

      {saveError && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </p>
      )}

      <BibleEditor value={rawValue} onChange={setRawValue} className="flex-1" />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus &ldquo;{data.bibleFile.title}&rdquo;?</DialogTitle>
            <DialogDescription>
              Bible file ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
