'use client';

import { useState, useRef } from 'react';
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
  AIGenerateWizard,
  CanonValidatorPanel,
  ReviewPackage,
  SceneEditor,
  type GenerateWizardValues,
  type StreamStatus,
  type ValidatorStatus,
  type CanonValidationSummary as UiCanonValidationSummary,
  type SceneEditorBlock,
} from '@suro-buya/ui';
import {
  episodesApi,
  scenesApi,
  charactersApi,
  regionsApi,
  generateSceneStream,
  validationApi,
  sceneVersionsApi,
  reviewsApi,
  blocksApi,
  type Scene,
  type ReviewDecision,
} from '@/lib/api-client';
import { EPISODE_STATUS_BADGE, SCENE_STATUS_BADGE, SCENE_STATUS_LABEL } from '../status-styles';

interface StreamState {
  status: StreamStatus;
  progress: number;
  currentStep?: string;
  streamedText: string;
  errorMessage?: string;
  finalText?: string;
}

interface ValidationState {
  status: ValidatorStatus;
  result?: UiCanonValidationSummary;
  errorMessage?: string;
}

const IDLE_STREAM_STATE: StreamState = { status: 'idle', progress: 0, streamedText: '' };

export default function EpisodeDetailPage() {
  const params = useParams<{ universeId: string; episodeId: string }>();
  const { universeId, episodeId } = params;
  const queryClient = useQueryClient();

  const [wizardScene, setWizardScene] = useState<Scene | null>(null);
  const [streamState, setStreamState] = useState<StreamState>(IDLE_STREAM_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [validationState, setValidationState] = useState<Record<string, ValidationState>>({});
  const [reviewScene, setReviewScene] = useState<Scene | null>(null);
  const [editScene, setEditScene] = useState<Scene | null>(null);
  const [editBlocks, setEditBlocks] = useState<SceneEditorBlock[]>([]);

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

  const charactersQuery = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.list(universeId),
  });

  const regionsQuery = useQuery({
    queryKey: ['regions', universeId],
    queryFn: () => regionsApi.list(universeId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['scenes', universeId, episodeId] });
    queryClient.invalidateQueries({ queryKey: ['episode', universeId, episodeId] });
    queryClient.invalidateQueries({ queryKey: ['episodes', universeId] });
  };

  const scenes = scenesQuery.data?.scenes ?? [];
  const availableCharacters = (charactersQuery.data?.characters ?? []).map((c) => ({
    id: c.characterId,
    name: c.displayName || c.name,
  }));
  const availableRegions = (regionsQuery.data?.regions ?? []).map((r) => ({
    id: r.regionId,
    name: r.name,
  }));

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

  const acceptSceneMutation = useMutation({
    mutationFn: (finalText: string) => {
      if (!wizardScene) throw new Error('No scene selected');
      return scenesApi.update(universeId, episodeId, wizardScene.id, {
        generatedText: finalText,
        status: 'VALIDATED',
      });
    },
    onSuccess: () => {
      invalidate();
      setWizardScene(null);
      setStreamState(IDLE_STREAM_STATE);
    },
  });

  const versionsQuery = useQuery({
    queryKey: ['scene-versions', universeId, episodeId, reviewScene?.id],
    queryFn: () => sceneVersionsApi.list(universeId, episodeId, reviewScene!.id),
    enabled: reviewScene !== null,
  });

  const reviewsQuery = useQuery({
    queryKey: ['scene-reviews', universeId, episodeId, reviewScene?.id],
    queryFn: () => reviewsApi.list(universeId, episodeId, reviewScene!.id),
    enabled: reviewScene !== null,
  });

  const submitReviewMutation = useMutation({
    mutationFn: ({ decision, feedback }: { decision: ReviewDecision; feedback: string }) => {
      if (!reviewScene) throw new Error('No scene selected');
      return reviewsApi.create(universeId, episodeId, reviewScene.id, {
        decision,
        feedback: feedback.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['scene-reviews', universeId, episodeId] });
      setReviewScene(null);
    },
  });

  const saveBlocksMutation = useMutation({
    mutationFn: () => {
      if (!editScene) throw new Error('No scene selected');
      return blocksApi.update(universeId, episodeId, editScene.id, editBlocks);
    },
    onSuccess: () => {
      invalidate();
      setEditScene(null);
    },
  });

  const episode = episodeQuery.data?.episode;
  const isLoading = episodeQuery.isLoading || scenesQuery.isLoading;

  function openWizard(scene: Scene) {
    setWizardScene(scene);
    setStreamState(IDLE_STREAM_STATE);
  }

  const initialEditBlocksRef = useRef<string>('');

  function openEditor(scene: Scene) {
    const fallbackBlocks: SceneEditorBlock[] = scene.generatedText
      ? [{ id: 'legacy-text', type: 'action', text: scene.generatedText }]
      : [];
    const blocks = scene.blocks && scene.blocks.length > 0 ? scene.blocks : fallbackBlocks;
    setEditScene(scene);
    setEditBlocks(blocks);
    initialEditBlocksRef.current = JSON.stringify(blocks);
  }

  function handleGenerate(values: GenerateWizardValues) {
    if (!wizardScene) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStreamState({ status: 'connecting', progress: 0, streamedText: '' });

    generateSceneStream(
      universeId,
      episodeId,
      wizardScene.id,
      {
        temperature: values.temperature,
        specialInstructions: values.specialInstructions,
      },
      {
        onChunk: (text) =>
          setStreamState((prev) => ({
            ...prev,
            status: 'streaming',
            streamedText: prev.streamedText + text,
          })),
        onProgress: (progress, step) =>
          setStreamState((prev) => ({ ...prev, progress, currentStep: step })),
        onDone: (_jobId, scene) =>
          setStreamState((prev) => ({
            ...prev,
            status: 'done',
            progress: 100,
            finalText: scene.generatedText ?? prev.streamedText,
          })),
        onError: (message) =>
          setStreamState((prev) => ({ ...prev, status: 'error', errorMessage: message })),
      },
      controller.signal
    ).catch(() => {
      // AbortError from a user-initiated cancel — already reflected via handleCancelGenerate.
    });
  }

  function handleCancelGenerate() {
    abortControllerRef.current?.abort();
    setStreamState((prev) => ({ ...prev, status: 'cancelled' }));
  }

  async function handleValidateScene(scene: Scene) {
    setValidationState((prev) => ({ ...prev, [scene.id]: { status: 'running' } }));
    try {
      const { validation } = await validationApi.run(universeId, episodeId, scene.id);
      setValidationState((prev) => ({ ...prev, [scene.id]: { status: 'done', result: validation } }));
      invalidate();
    } catch (err) {
      setValidationState((prev) => ({
        ...prev,
        [scene.id]: {
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Validasi gagal',
        },
      }));
    }
  }

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
            <Link href={`/${universeId}/episodes/${episodeId}/plan`}>
              <Button variant="outline">Rencana Beat</Button>
            </Link>
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

                      {scene.generatedText && (
                        <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-foreground">
                          {scene.generatedText}
                        </pre>
                      )}

                      {scene.generatedText && (
                        <CanonValidatorPanel
                          className="mt-3"
                          status={
                            validationState[scene.id]?.status ??
                            (scene.validationReport ? 'done' : 'idle')
                          }
                          result={
                            validationState[scene.id]?.result ??
                            (scene.validationReport as unknown as UiCanonValidationSummary | undefined)
                          }
                          errorMessage={validationState[scene.id]?.errorMessage}
                          onRunValidation={() => handleValidateScene(scene)}
                        />
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => openWizard(scene)}>
                        <Sparkles className="h-4 w-4" />
                        {scene.generatedText ? 'Regenerate' : 'Generate'}
                      </Button>
                      {scene.generatedText && (
                        <Button variant="outline" size="sm" onClick={() => openEditor(scene)}>
                          Edit
                        </Button>
                      )}
                      {scene.generatedText && (
                        <Button variant="outline" size="sm" onClick={() => setReviewScene(scene)}>
                          Review
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSceneToDelete(scene)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Hapus scene {scene.sceneNumber}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {wizardScene && (
        <AIGenerateWizard
          open={wizardScene !== null}
          onOpenChange={(open) => {
            if (!open) {
              setWizardScene(null);
              setStreamState(IDLE_STREAM_STATE);
            }
          }}
          sceneLabel={`Scene ${wizardScene.sceneNumber}`}
          initialValues={{
            premise: wizardScene.premise,
            characters: wizardScene.characters,
            region: wizardScene.region ?? undefined,
            specialInstructions: '',
            temperature: 0.7,
          }}
          availableCharacters={availableCharacters}
          availableRegions={availableRegions}
          status={streamState.status}
          progress={streamState.progress}
          currentStep={streamState.currentStep}
          streamedText={streamState.streamedText}
          errorMessage={streamState.errorMessage}
          finalText={streamState.finalText}
          onGenerate={handleGenerate}
          onCancelGenerate={handleCancelGenerate}
          onAccept={(finalText) => acceptSceneMutation.mutate(finalText)}
          isSaving={acceptSceneMutation.isPending}
        />
      )}

      <Dialog open={reviewScene !== null} onOpenChange={(open) => !open && setReviewScene(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Scene {reviewScene?.sceneNumber}</DialogTitle>
            <DialogDescription>
              Bandingkan versi, lalu approve, minta perbaikan, atau reject.
            </DialogDescription>
          </DialogHeader>
          {reviewScene && (
            <ReviewPackage
              sceneLabel={`Scene ${reviewScene.sceneNumber}`}
              versions={versionsQuery.data?.versions ?? []}
              reviews={(reviewsQuery.data?.reviews ?? []).map((r) => ({
                id: r.id,
                reviewerName: r.reviewer?.name || r.reviewer?.email || 'Reviewer',
                decision: r.decision,
                feedback: r.feedback,
                createdAt: r.createdAt,
              }))}
              isSubmitting={submitReviewMutation.isPending}
              onSubmitReview={(decision, feedback) =>
                submitReviewMutation.mutate({ decision, feedback })
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editScene !== null} onOpenChange={(open) => !open && setEditScene(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Scene {editScene?.sceneNumber}</DialogTitle>
            <DialogDescription>
              Edit per-block (aksi, dialog, transisi) — lebih presisi daripada edit teks polos.
            </DialogDescription>
          </DialogHeader>
          <SceneEditor
            blocks={editBlocks}
            onChange={setEditBlocks}
            availableCharacters={availableCharacters}
            onSave={() => saveBlocksMutation.mutate()}
            isSaving={saveBlocksMutation.isPending}
            isDirty={JSON.stringify(editBlocks) !== initialEditBlocksRef.current}
          />
        </DialogContent>
      </Dialog>

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
