'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Textarea,
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
import type { Character, CharacterRole } from '@/lib/api-client';

export const ROLE_OPTIONS: { value: CharacterRole; label: string }[] = [
  { value: 'PROTAGONIST', label: 'Protagonis' },
  { value: 'DEUTERAGONIST', label: 'Deuteragonis' },
  { value: 'SUPPORTING', label: 'Pendukung' },
  { value: 'ANTAGONIST', label: 'Antagonis' },
  { value: 'NARRATOR', label: 'Narator' },
];

export interface CharacterFormValues {
  characterId: string;
  name: string;
  displayName: string;
  role: CharacterRole;
  description: string;
  coreTraits: string; // comma-separated in the form, split into array on submit
  coreWeakness: string;
  voiceGuide: string;
}

function toFormValues(character?: Character | null): CharacterFormValues {
  if (!character) {
    return {
      characterId: '',
      name: '',
      displayName: '',
      role: 'SUPPORTING',
      description: '',
      coreTraits: '',
      coreWeakness: '',
      voiceGuide: '',
    };
  }
  return {
    characterId: character.characterId,
    name: character.name,
    displayName: character.displayName,
    role: character.role,
    description: character.description ?? '',
    coreTraits: character.coreTraits.join(', '),
    coreWeakness: character.coreWeakness,
    voiceGuide: character.voiceGuide ?? '',
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

interface CharacterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character?: Character | null; // null/undefined = create mode
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (values: CharacterFormValues) => void;
}

export function CharacterFormDialog({
  open,
  onOpenChange,
  character,
  isSubmitting,
  error,
  onSubmit,
}: CharacterFormDialogProps) {
  const isEditMode = Boolean(character);
  const [values, setValues] = useState<CharacterFormValues>(() => toFormValues(character));

  // Reset form contents whenever the dialog is (re)opened for a
  // (possibly different) character, or opened fresh for creation.
  useEffect(() => {
    if (open) {
      setValues(toFormValues(character));
    }
  }, [open, character]);

  function patch(p: Partial<CharacterFormValues>) {
    setValues((prev) => ({ ...prev, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const canSubmit =
    values.name.trim().length > 0 &&
    values.displayName.trim().length > 0 &&
    values.coreWeakness.trim().length > 0 &&
    (isEditMode || /^[a-z0-9-]+$/.test(values.characterId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? `Edit ${character?.name}` : 'Tambah Karakter'}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Perbarui detail dan voice guide karakter ini.'
                : 'Isi detail dasar karakter. Voice guide bisa ditambahkan sekarang atau nanti.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cf-name">Nama</Label>
                <Input
                  id="cf-name"
                  value={values.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const shouldAutoSync =
                      !isEditMode &&
                      (values.characterId === '' || values.characterId === slugify(values.name));
                    patch({
                      name,
                      displayName: values.displayName === values.name ? name : values.displayName,
                      ...(shouldAutoSync ? { characterId: slugify(name) } : {}),
                    });
                  }}
                  placeholder="mis. Suro"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-role">Peran</Label>
                <Select
                  value={values.role}
                  onValueChange={(role) => patch({ role: role as CharacterRole })}
                >
                  <SelectTrigger id="cf-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="cf-id">Character ID</Label>
                <Input
                  id="cf-id"
                  value={values.characterId}
                  onChange={(e) => patch({ characterId: slugify(e.target.value) })}
                  placeholder="suro"
                />
                <p className="text-xs text-muted-foreground">
                  Pengenal unik dalam universe ini. Tidak bisa diubah setelah dibuat.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cf-displayName">Nama Tampilan</Label>
              <Input
                id="cf-displayName"
                value={values.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
                placeholder="mis. Suro si Hiu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-description">Deskripsi</Label>
              <Textarea
                id="cf-description"
                value={values.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={3}
                placeholder="Deskripsi singkat karakter ini..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-traits">Sifat Utama</Label>
              <Input
                id="cf-traits"
                value={values.coreTraits}
                onChange={(e) => patch({ coreTraits: e.target.value })}
                placeholder="berani, penasaran, ceroboh (pisahkan dengan koma)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-weakness">Kelemahan Utama</Label>
              <Input
                id="cf-weakness"
                value={values.coreWeakness}
                onChange={(e) => patch({ coreWeakness: e.target.value })}
                placeholder="mis. Terlalu impulsif"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-voice">Voice Guide</Label>
              <Textarea
                id="cf-voice"
                value={values.voiceGuide}
                onChange={(e) => patch({ voiceGuide: e.target.value })}
                rows={6}
                placeholder="Bagaimana karakter ini berbicara — kosakata, ritme kalimat, ungkapan khas, hal yang dihindari..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Dipakai AI sebagai panduan gaya dialog karakter ini saat generate scene.
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
              {isEditMode ? 'Simpan Perubahan' : 'Tambah Karakter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
