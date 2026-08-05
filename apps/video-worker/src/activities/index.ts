/**
 * Suro-Buya Video Worker — Activity Exports (VF-3.5 + VF-4.1)
 *
 * Meng-export semua activity implementations. Worker (worker.ts) meng-import
 * file ini untuk mendaftarkan activities ke Temporal Worker.
 *
 * Workflow (workflows/media-job.ts) TIDAK meng-import file ini — workflow
 * hanya meng-import tipe interface (shared/interfaces.ts) dan menggunakan
 * proxyActivities untuk memanggil activities. Ini adalah pola Temporal:
 * workflow dan activity harus terpisah untuk memastikan workflow deterministik.
 *
 * VF-4.1: Added generateVoiceover activity for TTS per dialog.
 */

import { updateMediaAssetStatus, getMediaAsset } from './media-asset.js';
import { generateImage, generateVideoClip, generateVoiceover } from './media-generation.js';
import {
    buildTimelineActivity,
    renderRemotionActivity,
    encodeFfmpegActivity,
    updateVideoRenderStatusActivity,
    upsertVideoRenderJobActivity,
    getVideoRenderJobActivity,
} from './render-activities.js';

// Re-export individual activities
export { updateMediaAssetStatus, getMediaAsset } from './media-asset.js';
export { generateImage, generateVideoClip, generateVoiceover } from './media-generation.js';
export {
    buildTimelineActivity,
    renderRemotionActivity,
    encodeFfmpegActivity,
    updateVideoRenderStatusActivity,
    upsertVideoRenderJobActivity,
    getVideoRenderJobActivity,
} from './render-activities.js';

/**
 * Semua activity implementations dalam satu objek — dipakai Worker.create().
 * Temporal memetakan nama fungsi di objek ini ke nama activity di workflow.
 *
 * PENTING: key di sini HARUS sama persis dengan nama di interface
 * `RenderActivities` (workflows/render-workflow.ts) — proxyActivities()
 * memanggil lewat nama pendek (mis. `buildTimeline`), BUKAN nama fungsi
 * ber-suffix "Activity" yang dipakai di render-activities.ts. Tanpa
 * registrasi ini, renderWorkflow gagal runtime dengan error
 * "activity not registered" meski workflow-nya sendiri berhasil di-start.
 */
export const activities = {
    updateMediaAssetStatus,
    generateImage,
    generateVideoClip,
    generateVoiceover,
    buildTimeline: buildTimelineActivity,
    renderRemotion: renderRemotionActivity,
    encodeFfmpeg: encodeFfmpegActivity,
    updateVideoRenderStatus: updateVideoRenderStatusActivity,
    upsertVideoRenderJob: upsertVideoRenderJobActivity,
    getVideoRenderJob: getVideoRenderJobActivity,
};