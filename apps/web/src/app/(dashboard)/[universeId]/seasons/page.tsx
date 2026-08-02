'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Calendar, Film, Clock } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Button } from '@suro-buya/ui';
import { universesApi, seasonsApi } from '@/lib/api-client';

export default function SeasonsListPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;

  const { data: universeData, isLoading: universeLoading } = useQuery({
    queryKey: ['universes', universeId],
    queryFn: () => universesApi.get(universeId),
  });

  const { data: seasonsData, isLoading: seasonsLoading, isError } = useQuery({
    queryKey: ['seasons', universeId],
    queryFn: () => seasonsApi.list(universeId),
  });

  if (universeLoading || seasonsLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Memuat daftar season...</span>
      </div>
    );
  }

  if (isError || !seasonsData) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Gagal memuat daftar season.
      </div>
    );
  }

  const { universe } = universeData!;
  const seasons = seasonsData.seasons;

  return (
    <div>
      <Link
        href={`/${universeId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke {universe.name}
      </Link>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Season {universe.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola season dan rencanakan arc cerita
          </p>
        </div>
        <Button asChild>
          <Link href={`/${universeId}/seasons/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Season
          </Link>
        </Button>
      </div>

      {seasons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Belum ada season</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mulai dengan membuat season pertama untuk universe ini
            </p>
            <Button asChild className="mt-4">
              <Link href={`/${universeId}/seasons/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Season Pertama
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <Link key={season.id} href={`/${universeId}/seasons/${season.id}`}>
              <Card className="h-full transition-colors hover:bg-accent group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        Season {season.seasonNumber}: {season.title}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {season.theme || 'Belum ada tema'}
                      </p>
                    </div>
                    <Badge variant="outline">{season.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Film className="h-3.5 w-3.5" />
                      {season._count?.episodes || 0} episode
                    </span>
                    <span className="flex items-center gap-1">
                      <Film className="h-3.5 w-3.5" />
                      {season.episodeCount} eps planned
                    </span>
                  </div>
                  {season.plan && (
                    <div className="pt-2 border-t">
                      <Badge variant="secondary" className="text-xs">
                        Rencana sudah digenerate
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}