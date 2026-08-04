/**
 * Suro-Buya Video Worker — MediaJob Workflow (VF-3.5 + VF-4.1)
 *
 * Temporal workflow untuk memproses satu MediaJob (generate image, video clip,
 * atau audio voiceover per shot). Workflow ini adalah inti dari VF-3.5:
 *
 * - "Workflow untuk MediaJob" → mediaJobWorkflow function di bawah
 * - "retry policy" → DEFAULT_ACTIVITY_OPTIONS dengan retry policy
 * - "resume-on-crash" → Temporal durable execution: workflow state disimpan
 *   di Temporal server, jadi kalau worker crash, workflow resume dari titik
 *   terakhir saat worker baru tersedia (tidak mulai dari awal)
 *
 * VF-4.1: Added AUDIO type handling for TTS voiceover generation.
 *
 * Alur workflow:
 * 1. Update MediaAsset status → GENERATING
 * 2. Kalau type === 'IMAGE': panggil generateImage activity
 *    Kalau type === 'VIDEO_CLIP': panggil generateVideoClip activity
 *    Kalau type === 'AUDIO': panggil generateVoiceover activity (VF-4.1)
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
import { ApplicationFailure } from '@temporalio/common';
import type { MediaJobActivities, MediaJobWorkflowInput, MediaGenerationResult } from '../shared/interfaces.js';
import { DEFAULT_ACTIVITY_OPTIONS } from '../config.js';

/**
 * Activity proxy — memanggil activities via Temporal.
 * Pakai DEFAULT_ACTIVITY_OPTIONS dari config.ts (satu sumber kebenaran untuk
 * timeout & retry policy) — sebelumnya nilai ini di-hardcode ulang di sini
 * secara terpisah dari config.ts, berisiko drift kalau salah satu diubah
 * tanpa mengubah yang lain (lihat AUDIT-FINAL-REPORT.md).
 */
const activities = proxyActivities<MediaJobActivities>(DEFAULT_ACTIVITY_OPTIONS);

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
                mediaAssetId: input.mediaAssetId,
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
                mediaAssetId: input.mediaAssetId,
                keyframeUrl: input.keyframeUrl,
                shotSpec: input.shotSpec,
            });
        } else if (input.type === 'AUDIO') {
            // AUDIO butuh voiceProfile dari CharacterAsset (VF-4.1)
            if (!input.voiceProfile) {
                throw new Error(
                    'AUDIO job requires voiceProfile — set CharacterAsset.voiceProfile first',
                );
            }
            // AUDIO juga butuh dialogue di shotSpec
            if (!input.shotSpec.dialogue) {
                throw new Error(
                    'AUDIO job requires shotSpec.dialogue — shot has no dialogue to synthesize',
                );
            }
            result = await activities.generateVoiceover({
                mediaAssetId: input.mediaAssetId,
                shotSpec: input.shotSpec,
                voiceProfile: input.voiceProfile,
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

        // Ekstrak providerAttempts kalau activity gagal karena
        // MediaChainExhaustedError (lihat rethrowChainExhausted() di
        // media-generation.ts). Saat Activity gagal, ActivityFailure yang
        // dilempar ke workflow punya `.cause` berisi ApplicationFailure asli
        // — dan `.details[0]` adalah riwayat percobaan yang kita simpan di
        // sana. Tanpa ini, providerAttempts hilang total di jalur FAILED
        // (lihat AUDIT-FINAL-REPORT.md) — kita cuma tahu "gagal", bukan
        // provider mana saja yang sudah dicoba dan kenapa.
        const cause =
            err && typeof err === 'object' && 'cause' in err
                ? (err as { cause?: unknown }).cause
                : undefined;
        const attempts =
            cause instanceof ApplicationFailure && Array.isArray(cause.details?.[0])
                ? (cause.details[0] as { providerName: string; error: string }[])
                : undefined;
        const providerAttempts = attempts?.map((a) => a.providerName);

        await activities.updateMediaAssetStatus({
            mediaAssetId: input.mediaAssetId,
            status: 'FAILED',
            providerAttempts,
            lastError: errorMessage,
        });

        // Re-throw supaya Temporal tahu workflow gagal
        throw err;
    }
}