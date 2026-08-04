/**
 * Suro-Buya Video Worker — MediaAsset DB Activities (VF-3.5)
 *
 * Activity untuk update status MediaAsset di database (Prisma, VF-3.6).
 * Dipanggil oleh workflow di setiap transisi status:
 * - Awal: PENDING → GENERATING
 * - Retry: GENERATING → RETRYING
 * - Sukses: GENERATING → DONE (dengan resultUrl, cost, providerUsed)
 * - Gagal: RETRYING → FAILED (dengan lastError)
 *
 * Pola: activity adalah async function biasa — Temporal mengelola retry, idempotency,
 * dan resume-on-crash. Activity ini TIDAK perlu idempotent sendiri karena Prisma
 * update by ID aman untuk retry (update yang sama tidak ada efek samping).
 */

import { prisma } from '../lib/db.js';
import type { MediaAssetStatusUpdate } from '../shared/interfaces.js';

/**
 * Update status MediaAsset di database.
 *
 * Temporal akan retry activity ini kalau throw — Prisma update by ID aman untuk retry.
 * Field yang undefined tidak di-update (partial update via Prisma spread).
 */
export async function updateMediaAssetStatus(
    update: MediaAssetStatusUpdate,
): Promise<void> {
    const {
        mediaAssetId,
        status,
        providerUsed,
        providerAttempts,
        retryCount,
        resultUrl,
        cost,
        lastError,
    } = update;

    // Build update data — hanya field yang diisi yang di-update
    const data: Record<string, unknown> = { status };

    if (providerUsed !== undefined) {
        data['providerUsed'] = providerUsed;
    }
    if (providerAttempts !== undefined) {
        data['providerAttempts'] = providerAttempts;
    }
    if (retryCount !== undefined) {
        data['retryCount'] = retryCount;
    }
    if (resultUrl !== undefined) {
        data['resultUrl'] = resultUrl;
    }
    if (cost !== undefined) {
        data['cost'] = cost;
    }
    if (lastError !== undefined) {
        data['lastError'] = lastError;
    }

    await prisma.mediaAsset.update({
        where: { id: mediaAssetId },
        data,
    });
}

/**
 * Baca MediaAsset dari database.
 *
 * Dipakai oleh idempotency guard di media-generation.ts (checkAlreadyDone) —
 * cek status sebelum generate ulang. Bukan bagian dari MediaJobActivities
 * interface Temporal (dipanggil langsung sebagai fungsi biasa dalam proses
 * activity yang sama, bukan di-proxy lewat workflow).
 */
export async function getMediaAsset(mediaAssetId: string) {
    return prisma.mediaAsset.findUnique({
        where: { id: mediaAssetId },
    });
}