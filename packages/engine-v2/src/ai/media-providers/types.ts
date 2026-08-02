/**
 * Suro-Buya Engine v2 - Media Provider Types (VF-1.4)
 *
 * Kontrak request/response untuk image/video/voice provider. Terpisah dari
 * `ai/providers.ts` (LLM teks) karena media generation punya karakteristik
 * berbeda: durasi menit (bukan detik), butuh reference-image conditioning
 * untuk konsistensi karakter, dan dipanggil lewat fallback CHAIN (bukan
 * cuma primary/fallback tunggal seperti `ai/registry.ts`) — lihat
 * `MediaProviderRegistry` di registry.ts.
 */

/** Error khusus untuk kegagalan provider media — menyimpan nama provider yang gagal untuk debugging chain */
export class MediaProviderError extends Error {
    constructor(
        message: string,
        public readonly providerName: string,
        public override readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'MediaProviderError';
    }
}

/**
 * Dilempar saat SELURUH fallback chain habis tanpa ada yang berhasil.
 * Menyimpan riwayat percobaan untuk debugging/logging ke `MediaJob.providerAttempts`.
 */
export class MediaChainExhaustedError extends Error {
    constructor(
        message: string,
        public readonly attempts: { providerName: string; error: string }[],
    ) {
        super(message);
        this.name = 'MediaChainExhaustedError';
    }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export interface ImageGenerationRequest {
    /** Prompt visual untuk shot ini (dari ShotSpec.visualPrompt) */
    prompt: string;
    /**
     * URL reference image karakter (dari CharacterAsset.referenceImages) —
     * mekanisme konsistensi visual DEFAULT. Kosongkan hanya untuk generate
     * yang tidak melibatkan karakter existing (mis. background/environment shot).
     */
    referenceImages?: string[];
    negativePrompt?: string;
    /** Aspect ratio target, default provider biasanya 9:16 untuk short-form vertical */
    aspectRatio?: '9:16' | '16:9' | '1:1';
    seed?: number;
}

export interface ImageGenerationResult {
    url: string;
    providerName: string;
    /** Biaya generate ini dalam USD, kalau provider mengembalikan info tersebut */
    cost?: number;
    /** Metadata mentah dari provider, disimpan untuk debugging — TIDAK untuk ditampilkan ke user */
    raw?: unknown;
}

/** Provider untuk generate gambar/keyframe. Implementasi nyata (Nano Banana 2/Flux 2 Pro) ada di VF-3.1 — di VF-1.4 baru interface + mock. */
export interface ImageProvider {
    readonly name: string;
    generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
    isAvailable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Video (image-to-video / motion generation)
// ---------------------------------------------------------------------------

export interface VideoGenerationRequest {
    /** URL keyframe image hasil ImageProvider — video provider MENGANIMASIKAN gambar ini, bukan generate dari nol */
    keyframeUrl: string;
    /** Prompt tambahan untuk arah gerak (dari ShotSpec.motionPrompt), opsional — kalau kosong provider pakai motion default/preset */
    motionPrompt?: string;
    /** Durasi klip dalam detik (dari ShotSpec.duration) */
    duration: number;
    aspectRatio?: '9:16' | '16:9' | '1:1';
}

export interface VideoGenerationResult {
    url: string;
    providerName: string;
    durationActual: number;
    cost?: number;
    raw?: unknown;
}

/** Provider untuk image-to-video. Implementasi nyata (Kling 3.0/Seedance 2/Wan 2.7) ada di VF-3.3 — di VF-1.4 baru interface + mock. */
export interface VideoProvider {
    readonly name: string;
    generateClip(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
    isAvailable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Voice (TTS)
// ---------------------------------------------------------------------------

export interface VoiceSynthesisRequest {
    text: string;
    /** Dari CharacterAsset.voiceProfile — provider TIDAK boleh punya default voice sendiri di luar yang dikonfigurasi per-karakter */
    voiceId: string;
    settings?: Record<string, unknown>;
}

export interface VoiceSynthesisResult {
    url: string;
    providerName: string;
    durationActual: number;
    cost?: number;
    raw?: unknown;
}

/** Provider untuk TTS. Implementasi nyata (ElevenLabs/Cartesia/IndoTTS) ada di VF-4.1 — di VF-1.4 baru interface + mock. */
export interface VoiceProvider {
    readonly name: string;
    synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult>;
    isAvailable(): Promise<boolean>;
}

/** Union dipakai registry untuk generik lintas ketiga jenis provider */
export type AnyMediaProvider = ImageProvider | VideoProvider | VoiceProvider;
export type MediaKind = 'image' | 'video' | 'voice';