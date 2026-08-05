/**
 * Suro-Buya Video Worker — Render Workflow (VF-4.6 + VF-4.7)
 *
 * Temporal workflow untuk memproses full video render:
 * 1. Build timeline dari MediaAsset (engine-v2 timeline-builder)
 * 2. Render via Remotion (video-renderer composition)
 * 3. Encode via FFmpeg (video-renderer ffmpeg-encoder) per platform
 * 4. Simpan hasil ke VideoRender + VideoRenderJob (Prisma)
 *
 * Alur workflow:
 * 1. Update VideoRender status → RENDERING, create VideoRenderJob (attempt 1)
 * 2. Build timeline (activity)
 * 3. Render video via Remotion (activity) → raw MP4
 * 4. For each platform: encode via FFmpeg (activity) → final MP4
 * 5. Update VideoRender status → DONE, VideoRenderJob status → DONE
 * 6. Kalau gagal di step manapun: update status → FAILED, retry (max 3 attempts)
 *
 * Resume-on-crash:
 * - Temporal durable execution: state disimpan di Temporal server
 * - Worker crash → workflow resume dari titik terakhir
 * - Retry policy: 3 attempts dengan exponential backoff
 */

import { proxyActivities, defineQuery, defineSignal, setHandler, ApplicationFailure } from '@temporalio/workflow';
import type { RenderWorkflowInput, RenderWorkflowResult, RenderJobStatus } from '../shared/render-interfaces.js';
import type { UploadToR2Input, UploadToR2Result } from '../shared/render-interfaces.js';
import { DEFAULT_RENDER_ACTIVITY_OPTIONS } from '../config.js';

/**
 * Activity proxy untuk render activities.
 */
const activities = proxyActivities<RenderActivities>(DEFAULT_RENDER_ACTIVITY_OPTIONS);

/**
 * Query untuk cek status workflow dari client.
 * Returns detailed status object.
 */
export const getRenderStatus = defineQuery<{
    status: RenderWorkflowStatus;
    currentPlatform: string | null;
    attemptNumber: number;
    lastError: string | undefined;
}>('getRenderStatus');

/**
 * Signal untuk cancel workflow dari client.
 */
export const cancelRenderSignal = defineSignal('cancelRender');

/**
 * Status internal workflow.
 */
type RenderWorkflowStatus = 'BUILDING_TIMELINE' | 'RENDERING_REMOTION' | 'ENCODING_FFMPEG' | 'UPLOADING_R2' | 'DONE' | 'FAILED' | 'CANCELLED';

/**
 * Activity interface untuk render workflow.
 */
interface RenderActivities {
    /**
     * Build timeline dari MediaAsset project.
     */
    buildTimeline(input: BuildTimelineInput): Promise<BuildTimelineResult>;

    /**
     * Render video via Remotion composition.
     */
    renderRemotion(input: RenderRemotionInput): Promise<RenderRemotionResult>;

    /**
     * Encode video via FFmpeg per platform.
     */
    encodeFfmpeg(input: EncodeFfmpegInput): Promise<EncodeFfmpegResult>;

    /**
     * Upload encoded video ke Cloudflare R2 (VF-5.7).
     */
    uploadToR2(input: UploadToR2Input): Promise<UploadToR2Result>;

    /**
     * Update VideoRender status di DB.
     */
    updateVideoRenderStatus(input: UpdateVideoRenderStatusInput): Promise<void>;

    /**
     * Create/update VideoRenderJob record.
     */
    upsertVideoRenderJob(input: UpsertVideoRenderJobInput): Promise<void>;

    /**
     * Get VideoRenderJob untuk resume.
     */
    getVideoRenderJob(input: GetVideoRenderJobInput): Promise<VideoRenderJobRecord | null>;
}

/**
 * Input untuk buildTimeline activity.
 */
interface BuildTimelineInput {
    projectId: string;
    platforms: ('TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS')[];
}

/**
 * Hasil buildTimeline activity.
 */
interface BuildTimelineResult {
    timelineJson: string; // serialized VideoTimeline
    totalDuration: number;
    width: number;
    height: number;
}

/**
 * Input untuk renderRemotion activity.
 */
interface RenderRemotionInput {
    timelineJson: string;
    outputPath: string;
}

/**
 * Hasil renderRemotion activity.
 */
interface RenderRemotionResult {
    rawVideoPath: string;
    duration: number;
}

/**
 * Input untuk encodeFfmpeg activity.
 */
interface EncodeFfmpegInput {
    rawVideoPath: string;
    platform: 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS';
    outputPath: string;
    width: number;
    height: number;
}

/**
 * Hasil encodeFfmpeg activity.
 */
interface EncodeFfmpegResult {
    outputPath: string;
    fileSizeBytes: number;
    resolution: string;
    duration: number;
}

/**
 * Input untuk updateVideoRenderStatus activity.
 */
interface UpdateVideoRenderStatusInput {
    videoRenderId: string;
    status: 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED';
    videoUrl?: string;
    thumbnailUrl?: string;
    fileSizeBytes?: number;
    lastError?: string;
}

/**
 * Input untuk upsertVideoRenderJob activity.
 */
interface UpsertVideoRenderJobInput {
    videoRenderId: string;
    attemptNumber: number;
    providerUsed: string;
    status: RenderJobStatus;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    cost?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Input untuk getVideoRenderJob activity.
 */
interface GetVideoRenderJobInput {
    videoRenderId: string;
    attemptNumber: number;
}

/**
 * Record VideoRenderJob dari DB.
 */
interface VideoRenderJobRecord {
    id: string;
    videoRenderId: string;
    attemptNumber: number;
    providerUsed: string;
    status: RenderJobStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    error: string | null;
    cost: number | null;
    metadata: Record<string, unknown> | null;
}

/**
 * Workflow utama untuk full video render.
 *
 * @param input Data lengkap untuk render satu project multi-platform
 * @returns RenderWorkflowResult dengan URL per platform
 */
export async function renderWorkflow(
    input: RenderWorkflowInput,
): Promise<RenderWorkflowResult> {
    const { videoRenderId, projectId, platforms, maxAttempts = 3 } = input;

    let status: RenderWorkflowStatus = 'BUILDING_TIMELINE';
    let cancelled = false;
    let attemptNumber = 1;
    let lastError: string | undefined;

    // Register query handler
    setHandler(getRenderStatus, () => ({
        status,
        currentPlatform: currentPlatform,
        attemptNumber,
        lastError,
    }));

    // Register signal handler untuk cancel
    setHandler(cancelRenderSignal, () => {
        cancelled = true;
    });

    let currentPlatform: string | null = null;

    // Helper: cek cancel dan throw kalau sudah.
    // Pakai ApplicationFailure.nonRetryable supaya Temporal tidak retry
    // workflow task ini — cancel adalah intentional, bukan transient error.
    const checkCancelled = async (): Promise<void> => {
        if (cancelled) {
            status = 'CANCELLED';
            await activities.updateVideoRenderStatus({
                videoRenderId,
                status: 'FAILED',
                lastError: 'Cancelled by user',
            });
            throw ApplicationFailure.nonRetryable('Cancelled by user');
        }
    };

    // Loop untuk retry attempts
    while (attemptNumber <= maxAttempts) {
        try {
            // --- Step 1: Create/update VideoRenderJob untuk attempt ini ---
            await activities.upsertVideoRenderJob({
                videoRenderId,
                attemptNumber,
                providerUsed: 'remotion+ffmpeg',
                status: 'RENDERING',
                startedAt: new Date(),
            });

            // --- Step 2: Build Timeline ---
            status = 'BUILDING_TIMELINE';
            currentPlatform = null;
            await checkCancelled();

            const timelineResult = await activities.buildTimeline({
                projectId,
                platforms,
            });

            // --- Step 3: Render via Remotion ---
            status = 'RENDERING_REMOTION';
            await checkCancelled();

            // Path untuk raw video output Remotion
            const rawVideoPath = `/tmp/render-${videoRenderId}-raw.mp4`;

            const remotionResult = await activities.renderRemotion({
                timelineJson: timelineResult.timelineJson,
                outputPath: rawVideoPath,
            });

            // --- Step 4: Encode per platform via FFmpeg ---
            // --- Step 5: Upload encoded videos to R2 (VF-5.7) ---
            const platformResults: RenderWorkflowResult['platforms'] = [];

            for (const platform of platforms) {
                currentPlatform = platform;
                status = 'ENCODING_FFMPEG';
                await checkCancelled();

                const outputPath = `/tmp/render-${videoRenderId}-${platform.toLowerCase()}.mp4`;

                const encodeResult = await activities.encodeFfmpeg({
                    rawVideoPath,
                    platform,
                    outputPath,
                    width: timelineResult.width,
                    height: timelineResult.height,
                });

                // Upload to R2
                status = 'UPLOADING_R2';
                await checkCancelled();

                const r2Key = `renders/${projectId}/${videoRenderId}-${platform.toLowerCase()}.mp4`;
                const uploadResult = await activities.uploadToR2({
                    filePath: encodeResult.outputPath,
                    key: r2Key,
                    contentType: 'video/mp4',
                });

                platformResults.push({
                    platform,
                    videoUrl: uploadResult.presignedUrl, // Use presigned URL for secure access
                    thumbnailUrl: '', // TODO: generate thumbnail
                    fileSizeBytes: encodeResult.fileSizeBytes,
                    resolution: encodeResult.resolution,
                    duration: encodeResult.duration,
                });
            }

            // --- Step 5: Update VideoRender → DONE ---
            status = 'DONE';
            await activities.updateVideoRenderStatus({
                videoRenderId,
                status: 'DONE',
                videoUrl: platformResults[0]?.videoUrl, // Primary platform URL
                thumbnailUrl: platformResults[0]?.thumbnailUrl,
                fileSizeBytes: platformResults[0]?.fileSizeBytes,
            });

            // Update VideoRenderJob → DONE
            await activities.upsertVideoRenderJob({
                videoRenderId,
                attemptNumber,
                providerUsed: 'remotion+ffmpeg',
                status: 'DONE',
                completedAt: new Date(),
                cost: 0, // TODO: calculate actual cost
                metadata: { platforms: platformResults },
            });

            return {
                videoRenderId,
                status: 'DONE',
                platforms: platformResults,
            };
        } catch (err) {
            // Cancellation: re-throw langsung tanpa retry — cancel adalah
            // intentional, bukan error yang perlu di-retry.
            if (cancelled) {
                throw err;
            }

            // Temporal wraps activity errors in ActivityFailure — extract the
            // original cause message untuk error reporting yang meaningful.
            const causeMessage = (err as { cause?: { message?: string } })?.cause?.message;
            lastError = causeMessage ?? (err instanceof Error ? err.message : String(err));

            // Update VideoRenderJob → FAILED
            await activities.upsertVideoRenderJob({
                videoRenderId,
                attemptNumber,
                providerUsed: 'remotion+ffmpeg',
                status: 'FAILED',
                completedAt: new Date(),
                error: lastError,
            });

            // Kalau sudah attempt terakhir, update VideoRender → FAILED dan throw
            if (attemptNumber >= maxAttempts) {
                status = 'FAILED';
                await activities.updateVideoRenderStatus({
                    videoRenderId,
                    status: 'FAILED',
                    lastError,
                });
                throw err;
            }

            // Increment attempt dan retry
            attemptNumber++;
            // Wait sebelum retry (exponential backoff: 2s, 4s, 8s...)
            const backoffMs = Math.pow(2, attemptNumber) * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
    }

    // Should not reach here
    throw new Error('Render workflow exhausted all attempts');
}