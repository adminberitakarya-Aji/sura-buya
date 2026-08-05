/**
 * VF-4.7 — Studio Export Page
 *
 * Preview hasil compose. User bisa:
 * - Pilih platform target (TikTok, YouTube Shorts, Instagram Reels)
 * - Export video final (compose timeline → render → encode)
 * - Preview video hasil export
 * - Lihat metadata (durasi, resolusi, codec, file size)
 * - Retry failed renders
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { studioApi } from '@/lib/api-client';
import { exportApi, type VideoRenderSummary, type ExportResult, type RetryResult, type PlatformTarget } from '@/lib/export-api';
import { Sparkles, Download, AlertCircle, CheckCircle, Film, Smartphone, Youtube, Instagram, Loader, RotateCcw, Clock, XCircle, WifiOff } from 'lucide-react';

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
          PENDING
        </span>
      );
    case 'RENDERING':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <Loader className="h-3 w-3 animate-spin" />
          RENDERING
        </span>
      );
    case 'DONE':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          DONE
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          FAILED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {status}
        </span>
      );
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'PENDING':
      return <Clock className="h-4 w-4 text-gray-500" />;
    case 'RENDERING':
      return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'DONE':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <WifiOff className="h-4 w-4 text-gray-500" />;
  }
}

function PlatformIcon({ platform }: { platform: PlatformTarget }) {
  switch (platform) {
    case 'TIKTOK':
      return <Smartphone className="h-4 w-4" />;
    case 'YOUTUBE_SHORTS':
      return <Youtube className="h-4 w-4" />;
    case 'INSTAGRAM_REELS':
      return <Instagram className="h-4 w-4" />;
  }
}

function PlatformBadge({ platform }: { platform: PlatformTarget }) {
  const labels: Record<PlatformTarget, string> = {
    TIKTOK: 'TikTok',
    YOUTUBE_SHORTS: 'YouTube Shorts',
    INSTAGRAM_REELS: 'Instagram Reels',
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <PlatformIcon platform={platform} />
      {labels[platform]}
    </span>
  );
}

export default function ExportPage() {
  const params = useParams();
  const universeId = params.universeId as string;
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTarget>('TIKTOK');

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['studio-project', universeId, projectId],
    queryFn: () => studioApi.getProject(universeId, projectId),
  });

  const { data: exportData, isLoading: exportLoading, refetch: refetchExports } = useQuery({
    queryKey: ['export-status', universeId, projectId],
    queryFn: () => exportApi.getExportStatus(universeId, projectId),
    refetchInterval: (query) => {
      // Auto-refetch every 5s if any render is still PENDING or RENDERING
      const data = query.state.data;
      const hasActive = data?.renders.some((r: { status: string }) => r.status === 'PENDING' || r.status === 'RENDERING');
      return hasActive ? 5000 : false;
    },
  });

  const exportMutation = useMutation({
    mutationFn: (platform: PlatformTarget) =>
      exportApi.exportVideo(universeId, projectId, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-status', universeId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['studio-project', universeId, projectId] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (renderId: string) =>
      exportApi.retryRender(universeId, projectId, renderId),
    onSuccess: () => {
      refetchExports();
      queryClient.invalidateQueries({ queryKey: ['studio-project', universeId, projectId] });
    },
  });

  if (projectLoading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat project...</div>;
  }

  const project = projectData?.project;

  if (!project) {
    return <div className="text-center py-12 text-muted-foreground">Project tidak ditemukan.</div>;
  }

  const storyboard = project.storyboard;
  const hasStoryboard = Array.isArray(storyboard) && storyboard.length > 0;
  const projectStatus = project.status;
  const isReady = projectStatus === 'RENDERED' || projectStatus === 'GENERATING';

  const renders = exportData?.renders ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Export & Preview</p>
      </div>

      {/* Status Check */}
      {!hasStoryboard && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Generate storyboard terlebih dahulu sebelum export.
        </div>
      )}

      {hasStoryboard && !isReady && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Selesaikan generate visual & motion sebelum export. Status saat ini: {projectStatus}
        </div>
      )}

      {/* Export Controls */}
      {hasStoryboard && (
        <div className="rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Film className="h-5 w-5" />
            Export Video
          </h3>

          <p className="text-sm text-muted-foreground">
            Pilih platform target dan export video final. Video akan di-compose dari semua
            shot clips, voiceovers, SFX, dan BGM menjadi MP4 9:16 siap upload.
          </p>

          {/* Platform Selection */}
          <div className="grid grid-cols-3 gap-3">
            <PlatformCard
              platform="TIKTOK"
              selected={selectedPlatform === 'TIKTOK'}
              onClick={() => setSelectedPlatform('TIKTOK')}
              icon={<Smartphone className="h-5 w-5" />}
              label="TikTok"
              spec="1080×1920 · 30fps · H.264"
            />
            <PlatformCard
              platform="YOUTUBE_SHORTS"
              selected={selectedPlatform === 'YOUTUBE_SHORTS'}
              onClick={() => setSelectedPlatform('YOUTUBE_SHORTS')}
              icon={<Youtube className="h-5 w-5" />}
              label="YouTube Shorts"
              spec="1080×1920 · 30fps · H.264"
            />
            <PlatformCard
              platform="INSTAGRAM_REELS"
              selected={selectedPlatform === 'INSTAGRAM_REELS'}
              onClick={() => setSelectedPlatform('INSTAGRAM_REELS')}
              icon={<Instagram className="h-5 w-5" />}
              label="Instagram Reels"
              spec="1080×1920 · 30fps · H.264"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={() => exportMutation.mutate(selectedPlatform)}
            disabled={exportMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export to {selectedPlatform.replace('_', ' ')}
              </>
            )}
          </button>

          {exportMutation.isError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Error: {(exportMutation.error as Error).message}
            </div>
          )}

          {exportMutation.isSuccess && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Video render started! Status akan diperbarui otomatis.
            </div>
          )}
        </div>
      )}

      {/* Renders List */}
      {exportLoading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat renders...</div>
      ) : renders.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-semibold">Renders ({renders.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renders.map((render) => (
              <RenderCard
                key={render.id}
                render={render}
                onRetry={retryMutation.mutate}
                isRetrying={retryMutation.isPending && retryMutation.variables === render.id}
              />
            ))}
          </div>
        </div>
      ) : (
        hasStoryboard && (
          <div className="text-center py-8 text-muted-foreground">
            Belum ada render. Export video untuk melihat hasilnya di sini.
          </div>
        )
      )}
    </div>
  );
}

function PlatformCard({
  selected,
  onClick,
  icon,
  label,
  spec,
}: {
  platform: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  spec: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{spec}</p>
    </button>
  );
}

interface RenderCardProps {
  render: VideoRenderSummary & { status: string; width: number; height: number; workflowId: string; platform: PlatformTarget[] };
  onRetry: (renderId: string) => void;
  isRetrying: boolean;
}

function RenderCard({ render, onRetry, isRetrying }: RenderCardProps) {
  const platform = render.platform[0];
  const canRetry = render.status === 'FAILED' && !isRetrying;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="aspect-[9/16] bg-black rounded-t-lg overflow-hidden relative">
        {render.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={render.thumbnailUrl}
            alt={`Render ${platform}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Film className="h-8 w-8" />
          </div>
        )}
        {/* Status Badge Overlay */}
        <div className="absolute top-2 left-2 right-2 flex justify-between">
          <div className="flex gap-1">
            {render.platform.map((p, i) => (
              <PlatformBadge key={i} platform={p} />
            ))}
          </div>
          <div className="flex justify-end">
            {getStatusBadge(render.status)}
          </div>
        </div>
        {/* Progress indicator for RENDERING */}
        {render.status === 'RENDERING' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '50%' }} />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{platform.replace('_', ' ')}</span>
          <span className="text-xs text-muted-foreground">{render.width}×{render.height}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{render.duration.toFixed(1)}s</span>
          <span>{render.codec}</span>
          {render.fileSizeBytes && (
            <span>{(Number(render.fileSizeBytes) / 1024 / 1024).toFixed(1)} MB</span>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {render.status === 'DONE' && render.videoUrl && (
            <a
              href={render.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3 w-3" />
              Download MP4
            </a>
          )}
          
          {render.status === 'FAILED' && (
            <button
              onClick={() => onRetry(render.id)}
              disabled={isRetrying}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <Loader className="h-3 w-3 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </>
              )}
            </button>
          )}
          
          {render.status === 'PENDING' && (
            <span className="flex-1 text-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              Menunggu antrian...
            </span>
          )}
          
          {render.status === 'RENDERING' && (
            <span className="flex-1 text-center text-xs text-blue-600">
              <Loader className="h-3 w-3 inline animate-spin mr-1" />
              Rendering...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}