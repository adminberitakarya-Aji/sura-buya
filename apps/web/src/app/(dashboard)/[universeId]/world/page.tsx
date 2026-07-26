'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Map, Mountain } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@suro-buya/ui';
import { regionsApi, type Region } from '@/lib/api-client';
import { RegionFormDialog, type RegionFormValues } from './region-form-dialog';

export default function WorldPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['regions', universeId],
    queryFn: () => regionsApi.list(universeId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['regions', universeId] });

  const createMutation = useMutation({
    mutationFn: (values: RegionFormValues) =>
      regionsApi.create(universeId, {
        regionId: values.regionId,
        name: values.name,
        description: values.description || undefined,
        geography: values.geography || undefined,
        cultureGuide: values.cultureGuide || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: RegionFormValues) =>
      regionsApi.update(universeId, editingRegion!.regionId, {
        name: values.name,
        description: values.description || null,
        geography: values.geography || null,
        cultureGuide: values.cultureGuide || null,
      }),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditingRegion(null);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (regionId: string) => regionsApi.remove(universeId, regionId),
    onSuccess: () => {
      invalidate();
      setRegionToDelete(null);
    },
  });

  function openCreateDialog() {
    setEditingRegion(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditDialog(region: Region) {
    setEditingRegion(region);
    setFormError(null);
    setFormOpen(true);
  }

  function handleFormSubmit(values: RegionFormValues) {
    if (editingRegion) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  const regions = data?.regions ?? [];

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
          <h1 className="text-2xl font-bold text-foreground">World & Region</h1>
          <p className="text-sm text-muted-foreground">
            Kelola geografi dan panduan budaya tiap wilayah dalam universe ini.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Tambah Region
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat region...</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat daftar region. Coba muat ulang halaman.
        </div>
      )}

      {!isLoading && !isError && regions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Map className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Belum ada region</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Tambahkan region pertama untuk mulai membangun world bible universe ini.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Tambah Region
          </Button>
        </div>
      )}

      {!isLoading && !isError && regions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {regions.map((region) => (
            <Card key={region.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold">{region.name}</span>
                    {region.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {region.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(region)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {region.name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRegionToDelete(region)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Hapus {region.name}</span>
                    </Button>
                  </div>
                </div>

                {region.geography && (
                  <div className="mt-3 flex items-start gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    <Mountain className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{region.geography}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingRegion(null);
        }}
        region={editingRegion}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        error={formError}
        onSubmit={handleFormSubmit}
      />

      <Dialog
        open={regionToDelete !== null}
        onOpenChange={(open) => !open && setRegionToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus &ldquo;{regionToDelete?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Region ini akan dihapus permanen beserta geografi dan panduan budayanya.
              Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegionToDelete(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => regionToDelete && deleteMutation.mutate(regionToDelete.regionId)}
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

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Terjadi kesalahan. Coba lagi.';
}
