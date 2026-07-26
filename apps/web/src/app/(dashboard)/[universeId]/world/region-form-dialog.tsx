'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@suro-buya/ui';
import type { Region } from '@/lib/api-client';

export interface RegionFormValues {
  regionId: string;
  name: string;
  description: string;
  geography: string;
  cultureGuide: string;
}

function toFormValues(region?: Region | null): RegionFormValues {
  if (!region) {
    return { regionId: '', name: '', description: '', geography: '', cultureGuide: '' };
  }
  return {
    regionId: region.regionId,
    name: region.name,
    description: region.description ?? '',
    geography: region.geography ?? '',
    cultureGuide: region.cultureGuide ?? '',
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface RegionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region?: Region | null; // null/undefined = create mode
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (values: RegionFormValues) => void;
}

export function RegionFormDialog({
  open,
  onOpenChange,
  region,
  isSubmitting,
  error,
  onSubmit,
}: RegionFormDialogProps) {
  const isEditMode = Boolean(region);
  const [values, setValues] = useState<RegionFormValues>(() => toFormValues(region));

  useEffect(() => {
    if (open) {
      setValues(toFormValues(region));
    }
  }, [open, region]);

  function patch(p: Partial<RegionFormValues>) {
    setValues((prev) => ({ ...prev, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const canSubmit =
    values.name.trim().length > 0 && (isEditMode || /^[a-z0-9-]+$/.test(values.regionId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? `Edit ${region?.name}` : 'Tambah Region'}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Perbarui geografi dan panduan budaya region ini.'
                : 'Tambahkan region/wilayah baru ke world bible universe ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rf-name">Nama Region</Label>
              <Input
                id="rf-name"
                value={values.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const shouldAutoSync =
                    !isEditMode &&
                    (values.regionId === '' || values.regionId === slugify(values.name));
                  patch({ name, ...(shouldAutoSync ? { regionId: slugify(name) } : {}) });
                }}
                placeholder="mis. Jawa Timur"
                autoFocus
              />
            </div>

            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="rf-id">Region ID</Label>
                <Input
                  id="rf-id"
                  value={values.regionId}
                  onChange={(e) => patch({ regionId: slugify(e.target.value) })}
                  placeholder="jatim"
                />
                <p className="text-xs text-muted-foreground">
                  Pengenal unik dalam universe ini. Tidak bisa diubah setelah dibuat.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rf-description">Deskripsi</Label>
              <Textarea
                id="rf-description"
                value={values.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={3}
                placeholder="Gambaran singkat region ini..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rf-geography">Geografi</Label>
              <Textarea
                id="rf-geography"
                value={values.geography}
                onChange={(e) => patch({ geography: e.target.value })}
                rows={4}
                placeholder="Bentang alam, iklim, lokasi penting, tata kota..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rf-culture">Panduan Budaya</Label>
              <Textarea
                id="rf-culture"
                value={values.cultureGuide}
                onChange={(e) => patch({ cultureGuide: e.target.value })}
                rows={5}
                placeholder="Tradisi, bahasa/dialek, nilai-nilai lokal, hal yang perlu dijaga akurasinya..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Dipakai AI sebagai panduan akurasi budaya saat generate cerita di region ini.
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
              {isEditMode ? 'Simpan Perubahan' : 'Tambah Region'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
