/**
 * VF-2.6 — Series List Page
 *
 * Shows all VideoSeries in the universe with project counts.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { seriesApi } from '@/lib/api-client';
import { Plus, Film } from 'lucide-react';

export default function SeriesPage() {
  const params = useParams();
  const router = useRouter();
  const universeId = params.universeId as string;

  const { data, isLoading } = useQuery({
    queryKey: ['series', universeId],
    queryFn: () => seriesApi.list(universeId),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Series</h1>
          <p className="text-sm text-muted-foreground">
            Kelola series video dengan karakter yang sama lintas episode
          </p>
        </div>
        <button
          onClick={() => router.push(`/${universeId}/series/new`)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Series
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat...</div>
      ) : !data?.series || data.series.length === 0 ? (
        <div className="text-center py-12">
          <Film className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Belum ada series video.</p>
          <button
            onClick={() => router.push(`/${universeId}/series/new`)}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Buat series pertama →
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.series.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/${universeId}/series/${s.id}`)}
              className="rounded-lg border p-4 text-left hover:bg-accent transition-colors"
            >
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {s._count?.videoProjects ?? 0} episode
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {s.characterIds.length} karakter
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}