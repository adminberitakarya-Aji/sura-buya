'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Loader2, Sparkles, Trash2 } from 'lucide-react';
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
  Input,
  Textarea,
  Label,
} from '@suro-buya/ui';
import { episodesApi, scenesApi, type Scene } from '@/lib/api-client';
import { EPISODE_STATUS_BADGE, SCENE_STATUS_BADGE, SCENE_STATUS_LABEL } from '../status-styles';

export default function EpisodeDetailPage() {
  const params = useParams<{ universeId: string; episodeId: string }>();
  const { universeId, episodeId } = params;
  const queryClient = useQueryClient();

  const [sceneFormOpen, setSceneFormOpen] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<Scene | null>(null);
  const [premise, setPremise] = useState('');
  const [charactersInput, setCharactersInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const episodeQuery = useQuery({
    queryKey: ['episode', universeId, episodeId],
    queryFn: () => episodesApi.get(universeId, episodeId),
  });

  const scenesQuery = useQuery({
    queryKey: ['scenes', universeId, episodeId],
    queryFn: () => scenesApi.list(universeId, episodeId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['scenes', universeId, episodeId] });
    queryClient.invalidateQueries({ queryKey: ['episode', universeId, episodeId] });
    queryClient.invalidateQueries({ queryKey: ['episodes', universeId] });
  };

  const scenes = scenesQuery.data?.scenes ?? [];

  const createSceneMutation = useMutation({
    mutationFn: () =>
      scenesApi.create(universeId, episodeId, {
        sceneNumber: scenes.length + 1,
        premise,
        characters: charactersInput
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      invalidate();
      setSceneFormOpen(false);
      setPremise('');
      setCharactersInput('');
      setFormError(null);
    },
    onError: (err: unknown) =>
      setFormError(err instanceof Error ? err.message : 'Gagal membuat scene'),
  });

  const deleteSceneMutation = useMutation({
    mutationFn: (sceneId: string) => scenesApi.remove(universeId, episodeId, sceneId),
    onSuccess: () => {
      invalidate();
      setSceneToDelete(null);
    },
  });

  const episode = episodeQuery.data?.episode;
  const isLoading = episodeQuery.isLoading || scenesQuery.isLoading;

  return (
    <div>
      <Link
        href={`/${universeId}/episodes`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Episode
      </Link>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat episode...</span>
        </div>
      )}

      {episode && (
        <>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  S{episode.season?.seasonNumber}E{episode.episodeNumber}
                </span>
                <Badge variant={EPISODE_STATUS_BADGE[episode.status]}>{episode.status}</Badge>
              </div>
              <h1 className="mt-1 text-2xl font-bold text-foreground">{episode.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{episode.premise}</p>
            </div>
            <Button variant="outline" disabled title="Tersedia di step berikutnya (AI Generate Wizard)">
              <Sparkles className="h-4 w-4" />
              Generate Scene
            </Button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Scene ({scenes.length}/{episode.targetScenes})
            </h2>
            <Button
              size="sm"
              onClick={() => {
                setFormError(null);
                setSceneFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Tambah Scene
            </Button>
          </div>

          {scenes.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              Belum ada scene. Tambahkan scene pertama untuk episode ini.
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene) => (
                <Card key={scene.id}>
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          Scene {scene.sceneNumber}
                        </span>
                        <Badge variant={SCENE_STATUS_BADGE[scene.status]}>
                          {SCENE_STATUS_LABEL[scene.status]}
                        </Badge>
                        {scene.version > 1 && (
                          <span className="text-xs text-muted-foreground">v{scene.version}</span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {scene.premise}
                      </p>
                      {scene.characters.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {scene.characters.map((c) => (
                            <Badge key={c} variant="outline" className="font-normal">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSceneToDelete(scene)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Hapus scene {scene.sceneNumber}</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={sceneFormOpen} onOpenChange={setSceneFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scene Baru</DialogTitle>
            <DialogDescription>
              Definisikan premise scene. Konten lengkap bisa digenerate lewat AI Generate Wizard
              setelah scene ini dibuat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scene-premise">Premise</Label>
              <Textarea
                id="scene-premise"
                value={premise}
                onChange={(e) => setPremise(e.target.value)}
                rows={4}
                placeholder="Apa yang terjadi di scene ini?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-characters">Karakter (pisahkan dengan koma)</Label>
              <Input
                id="scene-characters"
                value={charactersInput}
                onChange={(e) => setCharactersInput(e.target.value)}
                placeholder="suro, buya"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSceneFormOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={!premise.trim() || createSceneMutation.isPending}
              onClick={() => createSceneMutation.mutate()}
            >
              {createSceneMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Buat Scene
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sceneToDelete !== null} onOpenChange={(open) => !open && setSceneToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Scene {sceneToDelete?.sceneNumber}?</DialogTitle>
            <DialogDescription>
              Scene ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSceneToDelete(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSceneMutation.isPending}
              onClick={() => sceneToDelete && deleteSceneMutation.mutate(sceneToDelete.id)}
            >
              {deleteSceneMutation.isPending ? (
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
