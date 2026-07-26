'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, BookOpen, Users, Map, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@suro-buya/ui';
import { universesApi, type UniverseSummary } from '@/lib/api-client';

const ROLE_LABEL: Record<UniverseSummary['role'], string> = {
  OWNER: 'Owner',
  EDITOR: 'Editor',
  REVIEWER: 'Reviewer',
  VIEWER: 'Viewer',
};

export default function UniversesPage() {
  const queryClient = useQueryClient();
  const [universeToDelete, setUniverseToDelete] = useState<UniverseSummary | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['universes'],
    queryFn: universesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (universeId: string) => universesApi.remove(universeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      setUniverseToDelete(null);
    },
  });

  const universes = data?.universes ?? [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Universe Saya</h1>
          <p className="text-sm text-muted-foreground">
            Kelola universe bible, karakter, dan produksi episode Anda.
          </p>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus className="h-4 w-4" />
            Buat Universe
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat universe...</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat daftar universe. Coba muat ulang halaman.
        </div>
      )}

      {!isLoading && !isError && universes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Belum ada universe</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Mulai dengan membuat universe pertama Anda — dari situ Anda bisa menulis
            character bible, world bible, hingga generate episode dengan AI.
          </p>
          <Button asChild>
            <Link href="/new">
              <Plus className="h-4 w-4" />
              Buat Universe Pertama
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && universes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {universes.map((universe) => (
            <Card key={universe.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>
                      <Link href={`/${universe.id}`} className="hover:underline">
                        {universe.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {universe.description || 'Belum ada deskripsi.'}
                    </CardDescription>
                  </div>
                  {universe.role === 'OWNER' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Menu universe</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setUniverseToDelete(universe)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Hapus Universe
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between pt-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {universe.counts.characters}
                  </span>
                  <span className="flex items-center gap-1">
                    <Map className="h-3.5 w-3.5" />
                    {universe.counts.regions}
                  </span>
                </div>
                <Badge variant={universe.role === 'OWNER' ? 'default' : 'secondary'}>
                  {ROLE_LABEL[universe.role]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={universeToDelete !== null}
        onOpenChange={(open) => !open && setUniverseToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus &ldquo;{universeToDelete?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus universe beserta seluruh character bible, world
              bible, episode, dan data terkait secara permanen. Tindakan ini tidak bisa
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUniverseToDelete(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => universeToDelete && deleteMutation.mutate(universeToDelete.id)}
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
