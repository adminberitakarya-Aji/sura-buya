'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Maximize2, Minimize2, Zap, RefreshCw } from 'lucide-react';
import { 
  Badge, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@suro-buya/ui';
import { seasonsApi, episodesApi } from '@/lib/api-client';
import { SeasonArcVisualizer } from '@suro-buya/ui';

export default function SeasonDetailPage() {
  const params = useParams<{ universeId: string; seasonId: string }>();
  const universeId = params.universeId;
  const seasonId = params.seasonId;

  const { data: seasonData, isLoading: seasonLoading, isError: seasonError } = useQuery({
    queryKey: ['seasons', seasonId],
    queryFn: () => seasonsApi.get(universeId, seasonId),
  });

  const { data: episodesData, isLoading: episodesLoading } = useQuery({
    queryKey: ['episodes', universeId, seasonId],
    queryFn: () => episodesApi.list(universeId, seasonId),
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  if (seasonLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Memuat season...</span>
      </div>
    );
  }

  if (seasonError || !seasonData) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Season tidak ditemukan.
        <div className="mt-3">
          <Link href={`/${universeId}/seasons`} className="underline">
            Kembali ke daftar season
          </Link>
        </div>
      </div>
    );
  }

  const { season } = seasonData!;
  const episodes = episodesData?.episodes || [];

  const handleGeneratePlan = async () => {
    try {
      await seasonsApi.generatePlan(universeId, seasonId, {
        episodeCount: season.episodeCount,
      });
      // Refresh queries
      window.location.reload();
    } catch (error) {
      console.error('Failed to generate plan:', error);
    }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen bg-background' : ''}>
      {!isFullscreen && (
        <Link
          href={`/${universeId}/seasons`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar season
        </Link>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Season {season.seasonNumber}: {season.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {season.theme || 'Belum ada tema'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!season.plan && (
            <Button onClick={handleGeneratePlan} disabled={seasonLoading}>
              <Zap className="h-4 w-4 mr-2" />
              Generate Season Plan
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="ml-2"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4 mr-2" />
                Keluar Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 mr-2" />
                Fullscreen
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">{season.status}</Badge>
        <Badge variant="secondary">{season.episodeCount} episode planned</Badge>
        {season.arcSummary && <Badge variant="outline">{season.arcSummary}</Badge>}
        {season.plan && <Badge variant="default">Plan Generated</Badge>}
      </div>

      <Tabs defaultValue="visualizer" className="h-[calc(100vh-280px)]">
        <TabsList className="mb-4">
          <TabsTrigger value="visualizer">Visualizer</TabsTrigger>
          <TabsTrigger value="episodes">Episode ({episodes.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="visualizer" className="h-full">
          <SeasonArcVisualizer
            seasonPlan={season.plan as any || {
              title: season.title,
              logline: season.theme || '',
              seasonNumber: season.seasonNumber,
              episodeCount: season.episodeCount,
              arcType: 'serialized',
              episodes: [],
              characterArcs: [],
              themes: [],
              actStructure: [],
            }}
            episodes={episodes}
            onEpisodeClick={(episodeNumber, episodeId) => {
              // Navigate to episode detail
              window.location.href = `/${universeId}/episodes/${episodeId}`;
            }}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="episodes" className="h-full overflow-y-auto">
          {episodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="text-lg">Belum ada episode</p>
              <p className="text-sm">Episode akan muncul setelah season plan digenerate</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((episode) => (
                <Link key={episode.id} href={`/${universeId}/episodes/${episode.id}`}>
                  <Card className="h-full transition-colors hover:bg-accent">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          Ep {episode.episodeNumber}: {episode.title}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {episode.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {episode.premise || 'Belum ada premise'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="h-full overflow-y-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Season</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Season Number</label>
                  <p className="font-medium">{season.seasonNumber}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Episode Count</label>
                  <p className="font-medium">{season.episodeCount}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <p className="font-medium capitalize">{season.status.toLowerCase()}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Created</label>
                  <p className="font-medium">{new Date(season.createdAt).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
              {season.theme && (
                <div>
                  <label className="text-xs text-muted-foreground">Theme</label>
                  <p className="font-medium">{season.theme}</p>
                </div>
              )}
              {season.arcSummary && (
                <div>
                  <label className="text-xs text-muted-foreground">Arc Summary</label>
                  <p className="font-medium">{season.arcSummary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {season.plan && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded max-h-96 overflow-auto">
                  {JSON.stringify(season.plan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}