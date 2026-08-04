/**
 * Suro-Buya Video Worker — Shared Interfaces (VF-3.5)
 *
 * Kontrak tipe yang dipakai bersama oleh workflow dan activities.
 * Temporal mengharuskan activity interface didefinisikan terpisah dari
 * implementasinya supaya workflow bisa meng-import tipe tanpa membawa
 * kode implementasi (yang bisa punya side-effect seperti DB connection).
 *
 * Lihat IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-3.5:
 * "Workflow untuk MediaJob, retry policy, resume-on-crash"
 */

import type { ShotSpec, CharacterVisualProfile, MediaAssetType } from '@suro-buya/shared';

/**
 * Input untuk MediaJob workflow.
 *
 * Dikirim oleh client (apps/web API route di VF-3.7) saat memulai workflow.
 * Berisi semua data yang dibutuhkan untuk generate satu media asset per shot —
 * tidak perlu query DB lagi di activity (idempotent, bisa di-retry tanpa side-effect).
 */
export interface MediaJobWorkflowInput {
    /** ID MediaAsset di Prisma (VF-3.6) — di-update sepanjang workflow */
    mediaAssetId: string;

    /** ID VideoProject yang memiliki MediaAsset ini */
    projectId: string;

    /** Index shot dalam storyboard (ShotSpec.index) */
    shotIndex: number;

    /** Jenis media: IMAGE (keyframe) atau VIDEO_CLIP (image-to-video) */
    type: MediaAssetType;

    /**
     * ShotSpec untuk shot ini — berisi visualPrompt, motionPrompt, cameraAngle, duration.
     * Diperlukan untuk build prompt yang dipass ke provider.
     */
    shotSpec: ShotSpec;

    /**
     * Visual profile karakter (dari CharacterAsset, VF-1.1) — berisi referenceImages,
     * styleTags, colorPalette, negativePrompt. Dipakai untuk reference-image conditioning.
     * Opsional: kosong untuk shot tanpa karakter (mis. background/environment shot).
     */
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;

    /**
     * Gaya visual opsional, mis. "2D digital, watercolor" — diteruskan ke prompt-builder.
     */
    artStyle?: string;

    /**
     * Untuk VIDEO_CLIP: URL keyframe image yang sudah digenerate (dari IMAGE job sebelumnya).
     * Wajib untuk type === 'VIDEO_CLIP' — video provider menganimasikan keyframe ini.
     */
    keyframeUrl?: string;
}

/**
 * Hasil generate media dari provider — dipakai oleh activity dan workflow.
 */
export interface MediaGenerationResult {
    /** URL asset hasil generate */
    resultUrl: string;
    /** Nama provider yang berhasil (mis. "nano-banana-2" atau "kling-3.0") */
    providerUsed: string;
    /** Semua provider yang dicoba (termasuk yang gagal) — untuk debugging */
    providerAttempts: string[];
    /** Biaya generate dalam USD */
    cost: number;
}

/**
 * Status update untuk MediaAsset — dipakai oleh activity updateMediaAssetStatus.
 */
export interface MediaAssetStatusUpdate {
    mediaAssetId: string;
    status: 'PENDING' | 'GENERATING' | 'DONE' | 'FAILED' | 'RETRYING';
    providerUsed?: string;
    providerAttempts?: string[];
    retryCount?: number;
    resultUrl?: string;
    cost?: number;
    lastError?: string;
}

/**
 * Activity interface — kontrak yang diimplementasi activities dan dipanggil
 * via proxyActivities di workflow. Temporal menggunakan ini untuk type safety.
 */
export interface MediaJobActivities {
    /**
     * Update status MediaAsset di database.
     * Dipanggil di awal (GENERATING), saat retry (RETRYING), dan di akhir (DONE/FAILED).
     */
    updateMediaAssetStatus(update: MediaAssetStatusUpdate): Promise<void>;

    /**
     * Generate keyframe image untuk satu shot.
     * Memakai ImageProvider registry (VF-3.1) dengan fallback chain.
     */
    generateImage(input: {
        shotSpec: ShotSpec;
        visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;
        artStyle?: string;
    }): Promise<MediaGenerationResult>;

    /**
     * Generate video clip (image-to-video) untuk satu shot.
     * Memakai VideoProvider registry (VF-3.3) dengan fallback chain.
     */
    generateVideoClip(input: {
        keyframeUrl: string;
        shotSpec: ShotSpec;
    }): Promise<MediaGenerationResult>;
}