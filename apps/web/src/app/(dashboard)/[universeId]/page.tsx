'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, Map, BookOpen, Loader2 } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@suro-buya/ui';
import { universesApi } from '@/lib/api-client';

export default function UniverseDetailPage() {
  const params = useParams<{ universeId: string }>();
  const universeId = params.universeId;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['universes', universeId],
    queryFn: () => universesApi.get(universeId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Memuat universe...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Universe tidak ditemukan, atau Anda tidak punya akses ke sana.
        <div className="mt-3">
          <Link href="/" className="underline">
            Kembali ke daftar universe
          </Link>
        </div>
      </div>
    );
  }

  const { universe } = data;
  const manifest = universe.manifest as {
    setting?: string;
    culturalContext?: string;
    targetAge?: { min: number; max: number };
  };

  return (
    <div>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Daftar Universe
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{universe.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {universe.description || 'Belum ada deskripsi.'}
          </p>
        </div>
        <Badge>{universe.version}</Badge>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Users className="h-5 w-5" />} label="Karakter" value={universe._count.characters} />
        <StatCard icon={<Map className="h-5 w-5" />} label="Region" value={universe._count.regions} />
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="Episode" value={universe._count.episodes} />
      </div>

      {(manifest.setting || manifest.culturalContext) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Setting & Konteks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {manifest.targetAge && (
              <p>
                Target usia: {manifest.targetAge.min}–{manifest.targetAge.max} tahun
              </p>
            )}
            {manifest.setting && <p>{manifest.setting}</p>}
            {manifest.culturalContext && <p>{manifest.culturalContext}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard href={`/${universeId}/bible`} title="Universe Bible" description="Character, world, story, visual, production bible" />
        <NavCard href={`/${universeId}/characters`} title="Karakter" description="Kelola character bible & voice guide" />
        <NavCard href={`/${universeId}/world`} title="World" description="Kelola region & world bible" />
        <NavCard href={`/${universeId}/episodes`} title="Episode" description="Rencanakan, generate, dan review episode" />
        <NavCard href={`/${universeId}/seasons`} title="Season" description="Rencanakan arc season & visualizer" />
        <NavCard href={`/${universeId}/settings/ai-providers`} title="Pengaturan AI" description="Konfigurasi provider per task" />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className="text-xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NavCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:bg-accent">
        <CardContent className="p-4">
          <div className="font-medium">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
