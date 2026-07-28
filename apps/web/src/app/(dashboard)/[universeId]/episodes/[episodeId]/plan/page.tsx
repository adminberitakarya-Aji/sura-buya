'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, ListPlus } from 'lucide-react';
import { Button, BeatBoard, type BeatBoardBeat } from '@suro-buya/ui';
import { episodesApi, planApi, type EpisodePlan } from '@/lib/api-client';

export default function EpisodePlanPage() {
  const params = useParams<{ universeId: string; episodeId: string }>();
  const { universeId, episodeId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [beats, setBeats] = useState<BeatBoardBeat[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const initialBeatsRef = useRef<string>('[]');

  const episodeQuery = useQuery({
    queryKey: ['episode', universeId, episodeId],
    queryFn: () => episodesApi.get(universeId, episodeId),
  });

  const episode = episodeQuery.data?.episode;
  const plan = (episode?.plan as EpisodePlan | null) ?? null;

  useEffect(() => {
    const planBeats = plan?.beats ?? [];
    setBeats(planBeats);
    initialBeatsRef.current = JSON.stringify(planBeats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, plan]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['episode', universeId, episodeId] });
    queryClient.invalidateQueries({ queryKey: ['episodes', universeId] });
  };

  const generateMutation = useMutation({
    mutationFn: () => planApi.generate(universeId, episodeId),
    onSuccess: ({ plan: newPlan }) => {
      setBeats(newPlan.beats);
      initialBeatsRef.current = JSON.stringify(newPlan.beats);
      setGenerateError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setGenerateError(err instanceof Error ? err.message : 'Gagal generate rencana episode'),
  });

  const saveBeatsMutation = useMutation({
    mutationFn: () => planApi.updateBeats(universeId, episodeId, beats),
    onSuccess: () => {
      initialBeatsRef.current = JSON.stringify(beats);
      invalidate();
    },
  });

  const createScenesMutation = useMutation({
    mutationFn: () => planApi.createScenesFromPlan(universeId, episodeId),
    onSuccess: ({ created }) => {
      invalidate();
      if (created > 0) {
        router.push(`/${universeId}/episodes/${episodeId}`);
      }
    },
  });

  const isDirty = JSON.stringify(beats) !== initialBeatsRef.current;

  return (
    <div>
      <Link
        href={`/${universeId}/episodes/${episodeId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Episode
      </Link>

      {episodeQuery.isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat episode...</span>
        </div>
      )}

      {episode && (
        <>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Rencana: {episode.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Susun beat cerita per act sebelum generate scene. Seret kartu buat mengatur urutan.
              </p>
            </div>
            {plan && plan.scenes?.length > 0 && (
              <Button
                variant="outline"
                onClick={() => createScenesMutation.mutate()}
                disabled={createScenesMutation.isPending}
              >
                {createScenesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListPlus className="h-4 w-4" />
                )}
                Buat Scene dari Rencana
              </Button>
            )}
          </div>

          {generateError && (
            <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {generateError}
            </p>
          )}

          {beats.length === 0 && !generateMutation.isPending ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                Belum ada rencana beat untuk episode ini. Generate lewat AI berdasarkan premise dan
                character bible universe.
              </p>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                Generate Plan
              </Button>
            </div>
          ) : (
            <BeatBoard
              beats={beats}
              onChange={setBeats}
              onGenerate={() => generateMutation.mutate()}
              isGenerating={generateMutation.isPending}
              onSave={() => saveBeatsMutation.mutate()}
              isSaving={saveBeatsMutation.isPending}
              isDirty={isDirty}
            />
          )}

          {plan?.summary && (
            <div className="mt-6 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Ringkasan AI</p>
              {plan.summary}
            </div>
          )}
        </>
      )}
    </div>
  );
}
