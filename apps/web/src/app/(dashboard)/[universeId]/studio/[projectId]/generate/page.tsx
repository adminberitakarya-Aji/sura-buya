/**
 * VF-3.7 — Studio Generate Page
 *
 * Progress monitor real-time, preview + regenerate per shot.
 */

'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { studioApi } from '@/lib/api-client';
import { generateApi, type MediaAssetSummary } from '@/lib/generate-api';
import { Sparkles, RefreshCw, ImageIcon, VideoIcon, AlertCircle, CheckCircle, Loader, DollarSign } from 'lucide-react';

export default function GeneratePage() {
  const params = useParams();
  const universeId = params.universeId as string;
  const projectId = params.projectId as string;

  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['studio-project', universeId, projectId],
    queryFn: () => studioApi.getProject(universeId, projectId),
  });

  const { data: genStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['generation-status', universeId, projectId],
    queryFn: () => generateApi.getGenerationStatus(universeId, projectId),
    refetchInterval: isPolling ? 2000 : false,
  });

  const startGenMutation = useMutation({
    mutationFn: (mode: 'images' | 'all') => generateApi.startGeneration(universeId, projectId, mode),
    onSuccess: () => {
      setIsPolling(true);
      refetchStatus();
    },
  });

  const regenMutation = useMutation({
    mutationFn: ({ shotIndex, type }: { shotIndex: number; type: 'IMAGE' | 'VIDEO_CLIP' }) =>
      generateApi.regenerateShot(universeId, projectId, shotIndex, type),
    onSuccess: () => {
      refetchStatus();
    },
  });

  useEffect(() => {
    if (genStatus && isPolling) {
      const { summary } = genStatus;
      const hasPending = summary.pending > 0 || summary.generating > 0;
      if (!hasPending) {
        setIsPolling(false);
      }
    }
  }, [genStatus, isPolling]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  if (projectLoading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat project...</div>;
  }

  const project = projectData?.project;

  if (!project) {
    return <div className="text-center py-12 text-muted-foreground">Project tidak ditemukan.</div>;
  }

  const storyboard = project.storyboard;
  if (!Array.isArray(storyboard) || storyboard.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate Visual & Motion</p>
        </div>
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Generate storyboard terlebih dahulu sebelum visual generation.
        </div>
      </div>
    );
  }

  const summary = genStatus?.summary;
  const totalShots = storyboard.length;
  const progressPercent = summary
    ? Math.round(((summary.done + summary.failed) / Math.max(summary.total, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate Visual & Motion</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => startGenMutation.mutate('all')}
          disabled={startGenMutation.isPending || isPolling}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {startGenMutation.isPending ? 'Generating...' : 'Generate All'}
        </button>
        <button
          onClick={() => startGenMutation.mutate('images')}
          disabled={startGenMutation.isPending || isPolling}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <ImageIcon className="h-4 w-4" />
          Images Only
        </button>
        {isPolling && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Loader className="h-3 w-3 animate-spin" />
            Polling...
          </span>
        )}
      </div>

      {startGenMutation.isError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Error: {(startGenMutation.error as Error).message}
        </div>
      )}

      {summary && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Progress</h3>
            <span className="text-sm text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600" />
              {summary.done} Done
            </span>
            {summary.generating > 0 && (
              <span className="flex items-center gap-1">
                <Loader className="h-3 w-3 animate-spin text-blue-600" />
                {summary.generating} Generating
              </span>
            )}
            {summary.pending > 0 && (
              <span className="text-muted-foreground">{summary.pending} Pending</span>
            )}
            {summary.failed > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {summary.failed} Failed
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground ml-auto">
              <DollarSign className="h-3 w-3" />
              ${(genStatus?.totalCost ?? 0).toFixed(4)}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold">Shots ({totalShots})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {storyboard.map((shot: any, i: number) => {
            const shotData = genStatus?.shots?.find((s) => s.shotIndex === shot.index);
            const imageAsset = shotData?.imageAsset;
            const videoAsset = shotData?.videoAsset;

            return (
              <ShotCard
                key={i}
                shot={shot}
                imageAsset={imageAsset ?? null}
                videoAsset={videoAsset ?? null}
                onRegenerate={(type) =>
                  regenMutation.mutate({ shotIndex: shot.index, type })
                }
                isRegenerating={
                  regenMutation.isPending &&
                  regenMutation.variables?.shotIndex === shot.index
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShotCard({
  shot,
  imageAsset,
  videoAsset,
  onRegenerate,
  isRegenerating,
}: {
  shot: any;
  imageAsset: MediaAssetSummary | null;
  videoAsset: MediaAssetSummary | null;
  onRegenerate: (type: 'IMAGE' | 'VIDEO_CLIP') => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <span className="font-medium text-sm">Shot {shot.index + 1}</span>
        <div className="flex gap-2">
          <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
            {shot.cameraAngle}
          </span>
          <span className="text-xs text-muted-foreground">{shot.duration}s</span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Keyframe
            </span>
            <StatusBadge status={imageAsset?.status} />
          </div>
          {imageAsset?.resultUrl ? (
            <div className="relative aspect-[9/16] bg-gray-100 rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageAsset.resultUrl}
                alt={`Shot ${shot.index + 1} keyframe`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[9/16] bg-gray-100 rounded flex items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
          {imageAsset?.cost != null && (
            <p className="text-xs text-muted-foreground mt-1">
              ${imageAsset.cost.toFixed(4)} · {imageAsset.providerUsed}
            </p>
          )}
          {imageAsset?.lastError && (
            <p className="text-xs text-red-600 mt-1">{imageAsset.lastError}</p>
          )}
          <button
            onClick={() => onRegenerate('IMAGE')}
            disabled={isRegenerating}
            className="mt-1 text-xs text-blue-600 hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </button>
        </div>

        {videoAsset && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium flex items-center gap-1">
                <VideoIcon className="h-3 w-3" />
                Video Clip
              </span>
              <StatusBadge status={videoAsset.status} />
            </div>
            {videoAsset.resultUrl ? (
              <video
                src={videoAsset.resultUrl}
                controls
                className="w-full aspect-[9/16] bg-black rounded object-cover"
              />
            ) : (
              <div className="aspect-[9/16] bg-gray-100 rounded flex items-center justify-center text-xs text-muted-foreground">
                No video
              </div>
            )}
            {videoAsset.cost != null && (
              <p className="text-xs text-muted-foreground mt-1">
                ${videoAsset.cost.toFixed(4)} · {videoAsset.providerUsed}
              </p>
            )}
            {videoAsset.lastError && (
              <p className="text-xs text-red-600 mt-1">{videoAsset.lastError}</p>
            )}
            <button
              onClick={() => onRegenerate('VIDEO_CLIP')}
              disabled={isRegenerating}
              className="mt-1 text-xs text-blue-600 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    GENERATING: 'bg-blue-100 text-blue-700',
    DONE: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    RETRYING: 'bg-yellow-100 text-yellow-700',
  };

  const icons: Record<string, React.ReactNode> = {
    GENERATING: <Loader className="h-3 w-3 animate-spin" />,
    DONE: <CheckCircle className="h-3 w-3" />,
    FAILED: <AlertCircle className="h-3 w-3" />,
  };

  return (
    <span className={`text-xs rounded-full px-2 py-0.5 flex items-center gap-1 ${styles[status] ?? ''}`}>
      {icons[status]}
      {status}
    </span>
  );
}