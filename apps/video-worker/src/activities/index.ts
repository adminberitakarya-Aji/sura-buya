/**
 * Suro-Buya Video Worker — Activity Exports (VF-3.5)
 *
 * Meng-export semua activity implementations. Worker (worker.ts) meng-import
 * file ini untuk mendaftarkan activities ke Temporal Worker.
 *
 * Workflow (workflows/media-job.ts) TIDAK meng-import file ini — workflow
 * hanya meng-import tipe interface (shared/interfaces.ts) dan menggunakan
 * proxyActivities untuk memanggil activities. Ini adalah pola Temporal:
 * workflow dan activity harus terpisah untuk memastikan workflow deterministik.
 */

import { updateMediaAssetStatus, getMediaAsset } from './media-asset.js';
import { generateImage, generateVideoClip } from './media-generation.js';

// Re-export individual activities
export { updateMediaAssetStatus, getMediaAsset } from './media-asset.js';
export { generateImage, generateVideoClip } from './media-generation.js';

/**
 * Semua activity implementations dalam satu objek — dipakai Worker.create().
 * Temporal memetakan nama fungsi di objek ini ke nama activity di workflow.
 */
export const activities = {
    updateMediaAssetStatus,
    generateImage,
    generateVideoClip,
};