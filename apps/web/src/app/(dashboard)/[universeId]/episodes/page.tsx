'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Loader2, Clapperboard, Film } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@suro-buya/ui';
import {
  episodesApi,
  seasonsApi,
  type Episode,
  type EpisodeStatus,
} from '@/lib/api-client';
import { EpisodeFormDialog, type EpisodeFormValues } from './episode-form-dialog';

const STATUS_COLUMNS: { status: EpisodeStatus; label: string }[] = [
  { status: 'PLANNING', label: 'Planning' },
  { status: 'GENERATING', label: 'Generating' },
  { status: 'REVIEW', label: 'Review' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'PUBLISHED', label: 'Published' },
  { status: 'ARCHIVED', label: 'Archived' },
];

export default function EpisodesPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const episodesQuery = useQuery({
    queryKey: ['episodes', universeId],
    queryFn: () => episodesApi.list(universeId),
  });

  const seasonsQuery = useQuery({
    queryKey: ['seasons', universeId],
    queryFn: () => seasonsApi.list(universeId),
  });

  const invalidateEpisodes = () =>
    queryClient.invalidateQueries({ queryKey: ['episodes', universeId] });

  const createSeasonMutation = useMutation({
    mutationFn: (title: string) =>
      seasonsApi.create(universeId, {
        seasonNumber: (seasonsQuery.data?.seasons.length ?? 0) + 1,
        title,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seasons', universeId] }),
  });

  const createEpisodeMutation = useMutation({
    mutationFn: (values: EpisodeFormValues) => episodesApi.create(universeId, values),
    onSuccess: () => {
      invalidateEpisodes();
      setFormOpen(false);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(errorMessage(err)),
  });

  const episodes = episodesQuery.data?.episodes ?? [];
  const seasons = seasonsQuery.data?.seasons ?? [];
  const isLoading = episodesQuery.isLoading || seasonsQuery.isLoading;
  const isError = episodesQuery.isError || seasonsQuery.isError;

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
          <h1 className="text-2xl font-bold text-foreground">Episode</h1>
          <p className="text-sm text-muted-foreground">
            Rencanakan, generate, dan review episode per season.
          </p>
        </div>
        <Button onClick={() => { setFormError(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />
          Episode Baru
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">Memuat episode...</span>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Gagal memuat data episode. Coba muat ulang halaman.
        </div>
      )}

      {!isLoading && !isError && episodes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Film className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Belum ada episode</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Buat episode pertama untuk mulai merencanakan beat, generate scene, dan review.
          </p>
          <Button onClick={() => { setFormError(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Episode Baru
          </Button>
        </div>
      )}

      {!isLoading && !isError && episodes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {STATUS_COLUMNS.map((col) => {
            const columnEpisodes = episodes.filter((e) => e.status === col.status);
            return (
              <div key={col.status} className="min-w-[240px]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <Badge variant="secondary">{columnEpisodes.length}</Badge>
                </div>
                <div className="space-y-3">
                  {columnEpisodes.map((episode) => (
                    <Link key={episode.id} href={`/${universeId}/episodes/${episode.id}`}>
                      <Card className="transition-colors hover:border-primary/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clapperboard className="h-3.5 w-3.5" />
                            S{episode.season?.seasonNumber ?? '?'}E{episode.episodeNumber}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                            {episode.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {episode._count?.scenes ?? 0}/{episode.targetScenes} scene
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {columnEpisodes.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Kosong
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EpisodeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        episode={null}
        seasons={seasons}
        isSubmitting={createEpisodeMutation.isPending}
        error={formError}
        onSubmit={(values) => createEpisodeMutation.mutate(values)}
        onCreateSeason={async (title) => {
          const result = await createSeasonMutation.mutateAsync(title);
          return result.season;
        }}
      />
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Terjadi kesalahan tidak terduga';
}
