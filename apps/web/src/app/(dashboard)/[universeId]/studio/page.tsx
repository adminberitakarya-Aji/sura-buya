/**
 * VF-2.6 — Studio Project List Page
 *
 * Shows all VideoProject in the universe. Entry point for video production.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { studioApi, charactersApi, seriesApi } from '@/lib/api-client';
import { Plus, Film, Trash2 } from 'lucide-react';

export default function StudioPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const universeId = params.universeId as string;

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [episodeOrder, setEpisodeOrder] = useState('');
  const [targetDuration, setTargetDuration] = useState<15 | 30 | 60>(15);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['studio-projects', universeId],
    queryFn: () => studioApi.listProjects(universeId),
  });

  const { data: charactersData } = useQuery({
    queryKey: ['characters', universeId],
    queryFn: () => charactersApi.list(universeId),
  });

  const { data: seriesData } = useQuery({
    queryKey: ['series', universeId],
    queryFn: () => seriesApi.list(universeId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      studioApi.createProject(universeId, {
        characterId,
        title,
        seriesId: seriesId || undefined,
        episodeOrder: episodeOrder ? parseInt(episodeOrder) : undefined,
        targetDuration,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-projects', universeId] });
      setShowCreate(false);
      setTitle('');
      setCharacterId('');
      setSeriesId('');
      setEpisodeOrder('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => studioApi.removeProject(universeId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-projects', universeId] });
    },
  });

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SCRIPTED: 'bg-blue-100 text-blue-700',
    STORYBOARDED: 'bg-purple-100 text-purple-700',
    GENERATING: 'bg-yellow-100 text-yellow-700',
    RENDERED: 'bg-green-100 text-green-700',
    REVIEWED: 'bg-teal-100 text-teal-700',
    EXPORTED: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Studio</h1>
          <p className="text-sm text-muted-foreground">
            Produksi video pendek dari karakter yang sudah ada
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Video
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Buat Video Project Baru</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Judul</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mis. Suro dan Harta Karun"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Karakter</label>
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Pilih karakter...</option>
                {charactersData?.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} ({c.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Series (opsional)</label>
              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Standalone (tidak series)</option>
                {seriesData?.series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Episode # (kalau series)</label>
              <input
                type="number"
                value={episodeOrder}
                onChange={(e) => setEpisodeOrder(e.target.value)}
                placeholder="1"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Durasi (detik)</label>
              <select
                value={targetDuration}
                onChange={(e) => setTargetDuration(Number(e.target.value) as 15 | 30 | 60)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value={15}>15 detik</option>
                <option value={30}>30 detik</option>
                <option value={60}>60 detik</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!title || !characterId || createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMutation.isPending ? 'Membuat...' : 'Buat'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat...</div>
      ) : !projectsData?.projects || projectsData.projects.length === 0 ? (
        <div className="text-center py-12">
          <Film className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Belum ada video project.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectsData.projects.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer"
              onClick={() => router.push(`/${universeId}/studio/${p.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  {p.character && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {p.character.displayName}
                    </p>
                  )}
                  {p.series && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.series.title}
                      {p.episodeOrder ? ` · Ep ${p.episodeOrder}` : ''}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[p.status] || 'bg-gray-100'}`}
                >
                  {p.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {(p.settings as any)?.targetDuration ?? 15}s
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Hapus project ini?')) {
                      deleteMutation.mutate(p.id);
                    }
                  }}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}