/**
 * Suro-Buya Video Worker — MediaJob Workflow (VF-3.5)
 *
 * Temporal workflow untuk memproses satu MediaJob (generate image atau video
 * clip per shot). Workflow ini adalah inti dari VF-3.5:
 *
 * - "Workflow untuk MediaJob" → mediaJobWorkflow function di bawah
 * - "retry policy" → DEFAULT_ACTIVITY_OPTIONS dengan retry policy
 * - "resume-on-crash" → Temporal durable execution: workflow state disimpan
 *   di Temporal server, jadi kalau worker crash, workflow resume dari titik
 *   terakhir saat worker baru tersedia (tidak mulai dari awal)
 *
 * Alur workflow:
 * 1. Update MediaAsset status → GENERATING
 * 2. Kalau type === 'IMAGE': panggil generateImage activity
 *    Kalau type === 'VIDEO_CLIP': panggil generateVideoClip activity
 * 3. Update MediaAsset status → DONE (dengan resultUrl, cost, providerUsed)
 * 4. Kalau activity gagal (setelah retry habis): update status → FAILED
 *
 * Resume-on-crash scenario:
 * - Worker crash setelah update GENERATING tapi sebelum generate selesai:
 *   Temporal re-execute activity generate di worker baru, status tetap GENERATING
 * - Worker crash di tengah generate: activity di-retry oleh Temporal
 *   (DEFAULT_RETRY_POLICY: 3 attempts dengan exponential backoff)
 * - Worker crash setelah generate selesai tapi sebelum update DONE:
 *   Temporal re-execute update DONE activity, MediaAsset tetap konsisten
 */

import { proxyActivities, defineQuery, defineSignal, setHandler } from '@temporalio/workflow';
import type { MediaJobActivities, MediaJobWorkflowInput, MediaGenerationResult } from '../shared/interfaces.js';

/**
 * Activity proxy — memanggil activities via Temporal.
 * startToCloseTimeout: 5 menit (media gen bisa lambat)
 * retry: DEFAULT_RETRY_POLICY (3 attempts, exponential backoff)
 */
const activities = proxyActivities<MediaJobActivities>({
    startToCloseTimeout: '5 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: 1000,
        maximumInterval: 30000,
        backoffCoefficient: 2.0,
    },
});

/**
 * Query untuk cek status workflow dari client (apps/web API route di VF-3.7).
 * Berguna untuk progress monitor real-time.
 */
export const getStatus = defineQuery<string>('getStatus');

/**
 * Signal untuk cancel workflow dari client.
 * Berguna untuk "cancel generation" button di UI.
 */
export const cancelSignal = defineSignal('cancel');

/**
 * Status internal workflow — dilacak untuk query.
 */
type WorkflowStatus = 'GENERATING' | 'DONE' | 'FAILED' | 'CANCELLED';

/**
 * Workflow utama untuk memproses satu MediaJob.
 *
 * @param input Data lengkap untuk generate satu media asset per shot
 * @returns MediaGenerationResult (url, providerUsed, cost, dll.)
 *
 * Temporal workflow HARUS deterministik — tidak boleh:
 * - Memanggil Date.now(), Math.random() langsung (pakai workflow.sleep, workflow.guid)
 * - Mengakses DB/env langsung (pakai activity)
 * - Meng-import modul yang punya side-effect
 */
export async function mediaJobWorkflow(
    input: MediaJobWorkflowInput,
): Promise<MediaGenerationResult> {
    let status: WorkflowStatus = 'GENERATING';
    let cancelled = false;

    // Register query handler untuk cek status
    setHandler(getStatus, () => status);

    // Register signal handler untuk cancel
    setHandler(cancelSignal, () => {
        cancelled = true;
    });

    try {
        // Step 1: Update MediaAsset status → GENERATING
        await activities.updateMediaAssetStatus({
            mediaAssetId: input.mediaAssetId,
            status: 'GENERATING',
        });

        // Cek cancel sebelum generate
        if (cancelled) {
            status = 'CANCELLED';
            await activities.updateMediaAssetStatus({
                mediaAssetId: input.mediaAssetId,
                status: 'FAILED',
                lastError: 'Cancelled by user',
            });
            throw new Error('Workflow cancelled by user');
        }

        // Step 2: Generate media berdasarkan type
        let result: MediaGenerationResult;

        if (input.type === 'IMAGE') {
            result = await activities.generateImage({
                shotSpec: input.shotSpec,
                visualProfile: input.visualProfile,
                artStyle: input.artStyle,
            });
        } else if (input.type === 'VIDEO_CLIP') {
            // VIDEO_CLIP butuh keyframeUrl dari IMAGE job sebelumnya
            if (!input.keyframeUrl) {
                throw new Error(
                    'VIDEO_CLIP job requires keyframeUrl — generate IMAGE first',
                );
            }
            result = await activities.generateVideoClip({
                keyframeUrl: input.keyframeUrl,
                shotSpec: input.shotSpec,
            });
        } else {
            throw new Error(`Unsupported media type: ${input.type}`);
        }

        // Cek cancel setelah generate (sebelum update DONE)
        if (cancelled) {
            status = 'CANCELLED';
            await activities.updateMediaAssetStatus({
                mediaAssetId: input.mediaAssetId,
                status: 'FAILED',
                lastError: 'Cancelled by user after generation',
            });
            throw new Error('Workflow cancelled by user');
        }

        // Step 3: Update MediaAsset status → DONE
        await activities.updateMediaAssetStatus({
            mediaAssetId: input.mediaAssetId,
            status: 'DONE',
            providerUsed: result.providerUsed,
            providerAttempts: result.providerAttempts,
            resultUrl: result.resultUrl,
            cost: result.cost,
        });

        status = 'DONE';
        return result;
    } catch (err) {
        // Step 4: Update MediaAsset status → FAILED
        status = 'FAILED';
        const errorMessage = err instanceof Error ? err.message : String(err);

        await activities.updateMediaAssetStatus({
            mediaAssetId: input.mediaAssetId,
            status: 'FAILED',
            lastError: errorMessage,
        });

        // Re-throw supaya Temporal tahu workflow gagal
        throw err;
    }
}