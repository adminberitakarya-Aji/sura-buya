'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Mic, Users } from 'lucide-react';
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
import { charactersApi, type Character } from '@/lib/api-client';
import { CharacterFormDialog, ROLE_OPTIONS, type CharacterFormValues } from './character-form-dialog';

export default function CharactersPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.list(universeId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['characters', universeId] });

  const createMutation = useMutation({
    mutationFn: (values: CharacterFormValues) =>
      charactersApi.create(universeId, {
        characterId: values.characterId,
        name: values.name,
        displayName: values.displayName,
        role: values.role,
        description: values.description || undefined,
        coreTraits: splitTraits(values.coreTraits),
        coreWeakness: values.coreWeakness,
        voiceGuide: values.voiceGuide || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: CharacterFormValues) =>
      charactersApi.update(universeId, editingCharacter!.characterId, {
        name: values.name,
        displayName: values.displayName,
        role: values.role,
        description: values.description || null,
        coreTraits: splitTraits(values.coreTraits),
        coreWeakness: values.coreWeakness,
        voiceGuide: values.voiceGuide || null,
      }),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditingCharacter(null);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (characterId: string) => charactersApi.remove(universeId, characterId),
    onSuccess: () => {
      invalidate();
      setCharacterToDelete(null);
    },
  });

  function openCreateDialog() {
    setEditingCharacter(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditDialog(character: Character) {
    setEditingCharacter(character);
    setFormError(null);
    setFormOpen(true);
  }

  function handleFormSubmit(values: CharacterFormValues) {
    if (editingCharacter) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  const characters = data?.characters ?? [];

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
          <h1 className="text-2xl font-bold text-foreground">Karakter</h1>
          <p className="text-sm text-muted-foreground">
            Kelola character bible dan voice guide untuk universe ini.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link href={`/${universeId}/characters/new`}>
            <Button variant="default">
              <Plus className="h-4 w-4 mr-1" />
              Wizard Karakter Baru (AI 2-Step)
            </Button>
          </Link>
          <Button variant="outline" onClick={openCreateDialog}>
            Quick Add
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat karakter...</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat daftar karakter. Coba muat ulang halaman.
        </div>
      )}

      {!isLoading && !isError && characters.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Users className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Belum ada karakter</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Tambahkan karakter pertama untuk mulai membangun character bible universe ini.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Tambah Karakter
          </Button>
        </div>
      )}

      {!isLoading && !isError && characters.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {characters.map((character) => (
            <Card key={character.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{character.displayName}</span>
                      <Badge variant="secondary">
                        {ROLE_OPTIONS.find((r) => r.value === character.role)?.label}
                      </Badge>
                    </div>
                    {character.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {character.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(character)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {character.name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCharacterToDelete(character)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Hapus {character.name}</span>
                    </Button>
                  </div>
                </div>

                {character.coreTraits.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {character.coreTraits.map((trait) => (
                      <Badge key={trait} variant="outline" className="font-normal">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">Kelemahan:</span> {character.coreWeakness}
                </p>

                {character.voiceGuide && (
                  <div className="mt-3 flex items-start gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{character.voiceGuide}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CharacterFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingCharacter(null);
        }}
        character={editingCharacter}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        error={formError}
        onSubmit={handleFormSubmit}
      />

      <Dialog
        open={characterToDelete !== null}
        onOpenChange={(open) => !open && setCharacterToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus &ldquo;{characterToDelete?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Karakter ini akan dihapus permanen beserta voice guide-nya. Tindakan ini tidak
              bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCharacterToDelete(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                characterToDelete && deleteMutation.mutate(characterToDelete.characterId)
              }
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

function splitTraits(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Terjadi kesalahan. Coba lagi.';
}
