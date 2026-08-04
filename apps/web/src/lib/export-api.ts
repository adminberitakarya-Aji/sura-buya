/**
 * VF-4.7 — Export API client extensions
 *
 * This file provides video export API methods.
 */

export type PlatformTarget = 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS';

export interface VideoRenderSummary {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
  resolution: string;
  platform: PlatformTarget;
  codec: string;
  fileSizeBytes: bigint | null;
  createdAt: string;
}

export interface ExportStatusResult {
  projectStatus: string;
  title: string;
  renders: VideoRenderSummary[];
}

export interface ExportResult {
  message: string;
  render: {
    id: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    duration: number;
    resolution: string;
    platform: PlatformTarget;
    codec: string;
    createdAt: string;
  };
}

/**
 * VF-4.7 Export API methods.
 */
export const exportApi = {
  exportVideo: async (
    universeId: string,
    projectId: string,
    platform: PlatformTarget = 'TIKTOK',
  ): Promise<ExportResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/export`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to export video');
    }
    return body as ExportResult;
  },

  getExportStatus: async (
    universeId: string,
    projectId: string,
  ): Promise<ExportStatusResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/export`,
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to get export status');
    }
    return body as ExportStatusResult;
  },
};