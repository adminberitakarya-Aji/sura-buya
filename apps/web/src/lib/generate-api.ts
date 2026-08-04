/**
 * VF-3.7 — Media Generation API client extensions
 *
 * This file provides media generation API methods.
 */

export type MediaAssetType = 'IMAGE' | 'VIDEO_CLIP' | 'AUDIO';
export type MediaJobStatus = 'PENDING' | 'GENERATING' | 'DONE' | 'FAILED' | 'RETRYING';

export interface MediaAssetSummary {
  id: string;
  projectId: string;
  shotIndex: number;
  type: MediaAssetType;
  status: MediaJobStatus;
  providerUsed: string | null;
  providerAttempts: string[];
  retryCount: number;
  resultUrl: string | null;
  cost: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationStatusResult {
  projectStatus: string;
  title: string;
  shots: Array<{
    shotIndex: number;
    shot: any;
    imageAsset: MediaAssetSummary | null;
    videoAsset: MediaAssetSummary | null;
  }>;
  totalCost: number;
  summary: {
    total: number;
    done: number;
    failed: number;
    pending: number;
    generating: number;
  };
}

export interface StartGenerationResult {
  message: string;
  started: Array<{ shotIndex: number; type: string; started: boolean }>;
  totalShots: number;
}

/**
 * VF-3.7 Media Generation API methods.
 */
export const generateApi = {
  startGeneration: async (
    universeId: string,
    projectId: string,
    mode: 'images' | 'all' = 'all',
  ): Promise<StartGenerationResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to start generation');
    }
    return body as StartGenerationResult;
  },

  getGenerationStatus: async (
    universeId: string,
    projectId: string,
  ): Promise<GenerationStatusResult> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/generate`,
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to get generation status');
    }
    return body as GenerationStatusResult;
  },

  regenerateShot: async (
    universeId: string,
    projectId: string,
    shotIndex: number,
    type: 'IMAGE' | 'VIDEO_CLIP',
  ): Promise<{ asset: MediaAssetSummary }> => {
    const res = await fetch(
      `/api/universes/${universeId}/studio/${projectId}/generate/regenerate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotIndex, type }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? 'Failed to regenerate shot');
    }
    return body as { asset: MediaAssetSummary };
  },
};