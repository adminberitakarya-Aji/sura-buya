/**
 * Suro-Buya Video Worker — Shared Interfaces (VF-3.5 + VF-4.1)
 *
 * Kontrak tipe yang dipakai bersama oleh workflow dan activities.
 * Temporal mengharuskan activity interface didefinisikan terpisah dari
 * implementasinya supaya workflow bisa meng-import tipe tanpa membawa
 * kode implementasi (yang bisa punya side-effect seperti DB connection).
 *
 * Lihat IMPLEMENTATION-PLAN-VIDEO-FACTORY.md VF-3.5:
 * "Workflow untuk MediaJob, retry policy, resume-on-crash"
 *
 * VF-4.1: Added generateVoiceover activity for TTS per dialog.
 */

import type { ShotSpec, CharacterVisualProfile, MediaAssetType } from '@suro-buya/shared';

/**
 * Input untuk MediaJob workflow.
 *
 * Dikirim oleh client (apps/web API route di VF-3.7) saat memulai workflow.
 * Berisi semua data yang dibutuhkan untuk generate satu media asset per shot.
 *
 * CATATAN (perbaikan audit VF-3, idempotency guard): activity generate TETAP
 * query DB (lewat mediaAssetId) di awal eksekusi untuk cek apakah asset ini
 * SUDAH selesai di attempt sebelumnya — bukan "tidak perlu query DB lagi"
 * seperti komentar lama di sini. Lihat media-generation.ts checkAlreadyDone().
 */
export interface MediaJobWorkflowInput {
    /** ID MediaAsset di Prisma (VF-3.6) — di-update sepanjang workflow */
    mediaAssetId: string;

    /** ID VideoProject yang memiliki MediaAsset ini */
    projectId: string;

    /** Index shot dalam storyboard (ShotSpec.index) */
    shotIndex: number;

    /** Jenis media: IMAGE (keyframe), VIDEO_CLIP (image-to-video), atau AUDIO (TTS voiceover) */
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

    /**
     * Untuk AUDIO: Voice profile karakter yang berbicara di shot ini (VF-4.1).
     * Berisi provider, voiceId, dan settings dari CharacterAsset.voiceProfile.
     * Wajib untuk type === 'AUDIO' — voice provider butuh voiceId per-karakter.
     */
    voiceProfile?: {
        provider: string;
        voiceId: string;
        settings?: Record<string, unknown>;
    };
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
    /**
     * true kalau hasil ini diambil dari MediaAsset yang sudah DONE sebelumnya
     * (idempotency guard) — TIDAK ada panggilan provider baru, TIDAK ada
     * biaya baru dikenakan. false/undefined = generate baru sungguhan.
     */
    fromCache?: boolean;
    /** Metadata untuk disimpan ke MediaAsset.metadata (opsional, mis. duration, characterId untuk VOICEOVER) */
    metadata?: Record<string, unknown>;
    /** Subtype untuk AUDIO (VOICEOVER, SFX, BGM) */
    subtype?: string;
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
    metadata?: Record<string, unknown>;
    subtype?: string;
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
     *
     * @param input.mediaAssetId Dipakai untuk idempotency guard — activity
     *   cek dulu status MediaAsset ini di DB sebelum memanggil provider.
     *   Kalau sudah DONE, return hasil lama tanpa generate ulang (mencegah
     *   double-billing kalau Temporal retry activity ini setelah crash
     *   pasca-provider-sukses-tapi-sebelum-tercatat-selesai).
     */
    generateImage(input: {
        mediaAssetId: string;
        shotSpec: ShotSpec;
        visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;
        artStyle?: string;
    }): Promise<MediaGenerationResult>;

    /**
     * Generate video clip (image-to-video) untuk satu shot.
     * Memakai VideoProvider registry (VF-3.3) dengan fallback chain.
     *
     * @param input.mediaAssetId Sama seperti generateImage — idempotency guard.
     */
    generateVideoClip(input: {
        mediaAssetId: string;
        keyframeUrl: string;
        shotSpec: ShotSpec;
    }): Promise<MediaGenerationResult>;

    /**
     * Generate voiceover (TTS) untuk satu shot (VF-4.1).
     * Memakai VoiceProvider registry (ElevenLabs → Cartesia → IndoTTS) dengan fallback chain.
     *
     * Voice profile dari CharacterAsset.voiceProfile — provider TIDAK boleh punya
     * default voice sendiri. Ini yang menjaga voice konsisten lintas episode.
     *
     * @param input.mediaAssetId Sama seperti generateImage — idempotency guard.
     * @param input.shotSpec Shot spec dengan dialogue (text + characterId)
     * @param input.voiceProfile Voice profile dari CharacterAsset
     */
    generateVoiceover(input: {
        mediaAssetId: string;
        shotSpec: ShotSpec;
        voiceProfile: {
            provider: string;
            voiceId: string;
            settings?: Record<string, unknown>;
        };
    }): Promise<MediaGenerationResult>;
}