/**
 * Suro-Buya Video Worker — Render Workflow Interfaces (VF-4.6 + VF-4.7)
 *
 * Kontrak tipe yang dipakai bersama oleh render workflow dan activities.
 * Temporal mengharuskan activity interface didefinisikan terpisah dari
 * implementasinya supaya workflow bisa meng-import tipe tanpa membawa
 * kode implementasi (yang bisa punya side-effect seperti DB connection).
 */

import type { PlatformTarget } from '@suro-buya/shared';
import type { VideoTimeline } from '@suro-buya/engine-v2';

/**
 * Input untuk Render workflow.
 *
 * Dikirim oleh client (apps/web API route) saat memulai workflow render.
 */
export interface RenderWorkflowInput {
    /** ID VideoRender di Prisma (sudah dibuat oleh API route) */
    videoRenderId: string;

    /** ID VideoProject yang akan di-render */
    projectId: string;

    /** Platform target untuk export — array untuk multi-platform */
    platforms: PlatformTarget[];

    /** Max retry attempts untuk workflow (default: 3) */
    maxAttempts?: number;
}

/**
 * Hasil render workflow.
 */
export interface RenderWorkflowResult {
    /** ID VideoRender */
    videoRenderId: string;

    /** Status final: 'DONE' | 'FAILED' */
    status: 'DONE' | 'FAILED';

    /** Hasil per platform */
    platforms: RenderPlatformResult[];
}

/**
 * Hasil render untuk satu platform.
 */
export interface RenderPlatformResult {
    /** Platform target */
    platform: PlatformTarget;

    /** URL video final (CDN URL di production, file:// di dev) */
    videoUrl: string;

    /** URL thumbnail */
    thumbnailUrl: string;

    /** Ukuran file dalam bytes */
    fileSizeBytes: number;

    /** Resolusi, mis. "1080x1920" */
    resolution: string;

    /** Durasi video dalam detik */
    duration: number;
}

/**
 * Status VideoRenderJob — mirror dari Prisma enum.
 */
export type RenderJobStatus = 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED';

/**
 * Input untuk buildTimeline activity.
 */
export interface BuildTimelineInput {
    /** ID VideoProject */
    projectId: string;

    /** Platform targets */
    platforms: PlatformTarget[];
}

/**
 * Hasil buildTimeline activity.
 */
export interface BuildTimelineResult {
    /** Serialized VideoTimeline (JSON string) */
    timelineJson: string;

    /** Total durasi video dalam detik */
    totalDuration: number;

    /** Width dalam pixel */
    width: number;

    /** Height dalam pixel */
    height: number;
}

/**
 * Input untuk renderRemotion activity.
 */
export interface RenderRemotionInput {
    /** Serialized VideoTimeline */
    timelineJson: string;

    /** Path output untuk raw video MP4 */
    outputPath: string;
}

/**
 * Hasil renderRemotion activity.
 */
export interface RenderRemotionResult {
    /** Path ke raw video file */
    rawVideoPath: string;

    /** Durasi video dalam detik */
    duration: number;
}

/**
 * Input untuk encodeFfmpeg activity.
 */
export interface EncodeFfmpegInput {
    /** Path ke raw video dari Remotion */
    rawVideoPath: string;

    /** Platform target */
    platform: PlatformTarget;

    /** Path output untuk encoded video */
    outputPath: string;

    /** Width dalam pixel */
    width: number;

    /** Height dalam pixel */
    height: number;
}

/**
 * Hasil encodeFfmpeg activity.
 */
export interface EncodeFfmpegResult {
    /** Path ke encoded video file */
    outputPath: string;

    /** Ukuran file dalam bytes */
    fileSizeBytes: number;

    /** Resolusi, mis. "1080x1920" */
    resolution: string;

    /** Durasi video dalam detik */
    duration: number;
}

/**
 * Input untuk uploadToR2 activity (VF-5.7).
 */
export interface UploadToR2Input {
    /** Local file path */
    filePath: string;
    /** R2 object key */
    key: string;
    /** Content-Type header */
    contentType: string;
}

/**
 * Hasil uploadToR2 activity.
 */
export interface UploadToR2Result {
    /** R2 object key */
    key: string;
    /** Public URL (if configured) */
    publicUrl?: string;
    /** Presigned download URL */
    presignedUrl: string;
    /** ETag dari R2 */
    etag?: string;
    /** File size in bytes */
    size: number;
}

/**
 * Input untuk updateVideoRenderStatus activity.
 */
export interface UpdateVideoRenderStatusInput {
    /** ID VideoRender */
    videoRenderId: string;

    /** Status baru */
    status: 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED';

    /** URL video final (opsional) */
    videoUrl?: string;

    /** URL thumbnail (opsional) */
    thumbnailUrl?: string;

    /** Ukuran file dalam bytes (opsional) */
    fileSizeBytes?: number;

    /** Error message kalau FAILED (opsional) */
    lastError?: string;
}

/**
 * Input untuk upsertVideoRenderJob activity.
 */
export interface UpsertVideoRenderJobInput {
    /** ID VideoRender */
    videoRenderId: string;

    /** Nomor attempt (1-based) */
    attemptNumber: number;

    /** Provider yang dipakai, mis. "remotion+ffmpeg" */
    providerUsed: string;

    /** Status job */
    status: RenderJobStatus;

    /** Waktu mulai (opsional) */
    startedAt?: Date;

    /** Waktu selesai (opsional) */
    completedAt?: Date;

    /** Error message kalau FAILED (opsional) */
    error?: string;

    /** Biaya render dalam USD (opsional) */
    cost?: number;

    /** Metadata tambahan (opsional) */
    metadata?: Record<string, unknown>;
}

/**
 * Input untuk getVideoRenderJob activity.
 */
export interface GetVideoRenderJobInput {
    /** ID VideoRender */
    videoRenderId: string;

    /** Nomor attempt */
    attemptNumber: number;
}

/**
 * Record VideoRenderJob dari DB.
 */
export interface VideoRenderJobRecord {
    /** ID VideoRenderJob */
    id: string;

    /** ID VideoRender */
    videoRenderId: string;

    /** Nomor attempt */
    attemptNumber: number;

    /** Provider yang dipakai */
    providerUsed: string;

    /** Status job */
    status: RenderJobStatus;

    /** Waktu mulai */
    startedAt: Date | null;

    /** Waktu selesai */
    completedAt: Date | null;

    /** Error message */
    error: string | null;

    /** Biaya dalam USD */
    cost: number | null;

    /** Metadata tambahan */
    metadata: Record<string, unknown> | null;
}