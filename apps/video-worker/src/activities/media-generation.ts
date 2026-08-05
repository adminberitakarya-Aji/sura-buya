/**
 * Suro-Buya Video Worker — Media Generation Activities (VF-3.5 + VF-4.1)
 *
 * Activity untuk generate media (image/video/audio) per shot via MediaProviderRegistry
 * (VF-1.4/VF-3.1/VF-3.3/VF-4.1). Fallback chain di-handle oleh registry — activity
 * ini hanya memanggil registry dan return hasilnya.
 *
 * Temporal retry policy (DEFAULT_RETRY_POLICY di config.ts) meng-handle retry
 * untuk transient failures (network, rate limit, provider timeout). Kalau
 * seluruh fallback chain habis, MediaChainExhaustedError dilempar dan workflow
 * menandai MediaAsset sebagai FAILED.
 *
 * VF-4.1: Added generateVoiceover activity for TTS per dialog.
 *
 * Validasi shot: sebelum memanggil provider (yang berbayar), kita jalankan
 * enforceStyleGuide() (VF-3.2) lewat validateShotOrThrow(). Violation error
 * (visualPrompt/cameraAngle kosong, duration invalid) dilempar sebagai
 * ApplicationFailure NON-RETRYABLE — data yang salah tidak akan berubah kalau
 * di-retry, jadi tidak perlu buang 3x percobaan + waktu ke provider API.
 *
 * CATATAN soal resume-on-crash & idempotency (perbaikan audit VF-3):
 * Temporal retry (worker crash ATAU transient failure) mengeksekusi ULANG
 * seluruh fungsi activity dari awal — termasuk panggilan provider API yang
 * berbayar. Kalau tidak dijaga, ini bisa menyebabkan generate ulang (dan
 * biaya dobel) kalau crash terjadi SETELAH provider sukses tapi SEBELUM
 * Temporal mencatat activity selesai.
 *
 * Mitigasi: checkAlreadyDone() di awal generateImage()/generateVideoClip()/
 * generateVoiceover() mengecek status MediaAsset di DB — kalau sudah `DONE`
 * dengan `resultUrl` terisi, activity return hasil lama (`fromCache: true`)
 * TANPA memanggil provider lagi. Ini bukan "exactly-once" sempurna (masih
 * ada celah kecil: generate sukses TAPI belum sempat updateMediaAssetStatus(DONE)
 * tercatat di DB saat crash terjadi — di titik itu status masih GENERATING,
 * jadi guard ini tidak menangkapnya dan provider tetap dipanggil ulang), tapi
 * menutup kasus paling umum: retry SETELAH DONE tercatat.
 */

import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';
import {
    buildAllPrompts,
    resolveMotionPrompt,
    enforceStyleGuide,
    MediaChainExhaustedError,
} from '@suro-buya/engine-v2';
import type { MediaGenerationResult } from '../shared/interfaces.js';
import { getMediaAsset } from './media-asset.js';
import {
    createImageRegistry,
    createVideoRegistry,
    createVoiceRegistry,
    createMockImageRegistry,
    createMockVideoRegistry,
    createMockVoiceRegistry,
} from '../lib/provider-setup.js';
import type { MediaProviderKeyConfig } from '../config.js';
import { ApplicationFailure } from '@temporalio/common';

/**
 * Jalankan style-guide enforcer (VF-3.2) untuk SATU shot sebelum generate.
 *
 * CATATAN PENTING (perbaikan audit VF-3): sebelumnya activity ini langsung
 * build prompt & panggil provider TANPA pernah memanggil enforceStyleGuide()
 * — jadi acceptance criteria VF-3 #1 ("karakter konsisten di seluruh shot")
 * tidak pernah tervalidasi di jalur produksi (video-worker adalah satu-satunya
 * jalur yang benar-benar dieksekusi Temporal; packages/engine-v2/src/visual/
 * image-generator.ts yang MEMANGGIL enforceStyleGuide() tidak dipakai worker).
 *
 * Kita panggil enforceStyleGuide dengan array 1 shot ([shotSpec]) karena di
 * level activity kita cuma punya 1 shot (desain per-MediaAsset Temporal) —
 * ini tetap menangkap error struktural shot itu sendiri (visualPrompt/
 * cameraAngle kosong, duration <= 0) dan warning konsistensi visual profile
 * (reference images/style tags/color palette hilang). Cek "8+ shot tanpa
 * reference image" dari enforceStyleGuide butuh full shot list dan TIDAK
 * bisa dicek di sini — itu tetap tanggung jawab caller (apps/web) saat
 * validasi storyboard penuh sebelum membuat MediaAsset per shot.
 *
 * Violation dengan severity 'error' dilempar sebagai ApplicationFailure
 * non-retryable — data yang salah tidak akan berubah kalau di-retry, jadi
 * kita gagalkan cepat dan tidak buang 3x percobaan + waktu ke provider API.
 */
function validateShotOrThrow(
    shotSpec: ShotSpec,
    visualProfile: Omit<CharacterVisualProfile, 'characterId'> | undefined,
): void {
    const styleGuideResult = enforceStyleGuide([shotSpec], visualProfile);

    if (!styleGuideResult.passed) {
        const errorViolations = styleGuideResult.violations.filter(
            (v) => v.severity === 'error',
        );
        const message =
            `Style guide validation failed for shot ${shotSpec.index}: ` +
            errorViolations
                .map((v) => `${v.field}: ${v.message}`)
                .join('; ');

        throw ApplicationFailure.nonRetryable(
            message,
            'StyleGuideViolation',
        );
    }
}

/**
 * Bungkus MediaChainExhaustedError (registry.ts) sebagai ApplicationFailure
 * dengan `details` berisi riwayat percobaan per-provider.
 *
 * Kenapa perlu: Temporal TIDAK meng-otomatis-serialize custom property
 * (mis. `.attempts` di MediaChainExhaustedError) saat error menyeberang dari
 * activity ke workflow — hanya `message`/`stack`/`cause` yang dibawa secara
 * default. Tanpa ini, workflow (media-job.ts) cuma dapat pesan generik dan
 * `providerAttempts` hilang total di jalur FAILED (lihat AUDIT-FINAL-REPORT.md).
 * `details` di ApplicationFailure memang didesain untuk data terstruktur
 * seperti ini dan aman diserialisasi lintas activity/workflow boundary.
 */
function rethrowChainExhausted(err: unknown): never {
    if (err instanceof MediaChainExhaustedError) {
        throw ApplicationFailure.retryable(
            err.message,
            'MediaChainExhausted',
            err.attempts, // details[0] — dibaca lagi di workflow catch block
        );
    }
    throw err;
}

/**
 * Idempotency guard (perbaikan audit VF-3): cek apakah MediaAsset ini SUDAH
 * selesai (`DONE` + `resultUrl` terisi) dari eksekusi sebelumnya.
 *
 * Kenapa perlu: Temporal retry (baik karena worker crash maupun transient
 * failure) MENGEKSEKUSI ULANG SELURUH FUNGSI activity dari awal — termasuk
 * panggilan provider API yang BERBAYAR. Tanpa guard ini, activity yang
 * "sukses tapi belum sempat dicatat selesai oleh Temporal" akan generate
 * ULANG dari nol saat di-retry, dan biaya nyata ke provider bisa dobel
 * (lihat AUDIT-FINAL-REPORT.md — activity generate SEBELUMNYA diklaim
 * "idempotent" padahal tidak).
 *
 * Trade-off yang disadari: ini menambah 1 query DB di awal setiap activity
 * attempt (termasuk attempt pertama yang normal, belum tentu retry) — biaya
 * ini jauh lebih murah dibanding risiko generate ulang gambar/video berbayar.
 *
 * @returns MediaGenerationResult dari DB (fromCache: true) kalau sudah DONE,
 *          null kalau belum (activity lanjut generate seperti biasa).
 */
async function checkAlreadyDone(
    mediaAssetId: string,
): Promise<MediaGenerationResult | null> {
    const asset = await getMediaAsset(mediaAssetId);

    if (asset && asset.status === 'DONE' && asset.resultUrl) {
        return {
            resultUrl: asset.resultUrl,
            providerUsed: asset.providerUsed ?? 'unknown',
            providerAttempts: asset.providerAttempts ?? [],
            cost: asset.cost ?? 0,
            fromCache: true,
        };
    }

    // MediaAsset tidak ada, atau statusnya bukan DONE (PENDING/GENERATING/
    // FAILED/RETRYING) — belum ada hasil valid untuk dipakai ulang, lanjut generate.
    return null;
}

/**
 * Cek apakah kita punya API keys nyata. Kalau tidak, pakai mock registry.
 * Ini memungkinkan worker berjalan di development tanpa API key, dan
 * testing tanpa mocking provider nyata.
 */
function shouldUseMock(keys: MediaProviderKeyConfig): boolean {
    return !keys.falApiKey && !keys.geminiApiKey && !keys.elevenlabsApiKey && !keys.cartesiaApiKey;
}

/**
 * Activity: Generate keyframe image untuk satu shot.
 *
 * Alur:
 * 1. Build prompt via prompt-builder (VF-2.5) — visualPrompt + negativePrompt
 * 2. Buat MediaProviderRegistry (VF-3.1: Nano Banana 2 → Flux 2 Pro)
 * 3. Panggil registry.generateImage() — fallback chain otomatis
 * 4. Return result (url, providerUsed, attempts, cost)
 *
 * @param input.mediaAssetId ID MediaAsset di DB — dipakai idempotency guard
 * @param input.shotSpec Shot spec dengan visualPrompt, cameraAngle, dll.
 * @param input.visualProfile Visual profile karakter (reference images, style tags)
 * @param input.artStyle Gaya visual opsional
 */
export async function generateImage(input: {
    mediaAssetId: string;
    shotSpec: ShotSpec;
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;
    artStyle?: string;
}): Promise<MediaGenerationResult> {
    const { mediaAssetId, shotSpec, visualProfile, artStyle } = input;

    // Idempotency guard — lihat checkAlreadyDone() untuk penjelasan lengkap.
    const cached = await checkAlreadyDone(mediaAssetId);
    if (cached) return cached;

    // Validasi shot sebelum keluar uang ke provider (VF-3.2 style guide, VF-3 AC #1)
    validateShotOrThrow(shotSpec, visualProfile);

    // Build prompts (VF-2.5)
    const prompts = buildAllPrompts({
        shot: shotSpec,
        visualProfile,
        artStyle,
    });

    // Setup registry — pakai mock kalau tidak ada API key
    const keys: MediaProviderKeyConfig = {
        falApiKey: process.env['FAL_API_KEY'] || undefined,
        geminiApiKey: process.env['GEMINI_API_KEY'] || undefined,
        elevenlabsApiKey: process.env['ELEVENLABS_API_KEY'] || undefined,
        cartesiaApiKey: process.env['CARTESIA_API_KEY'] || undefined,
        indoTtsBaseUrl: process.env['INDO_TTS_BASE_URL'] || undefined,
        indoTtsApiKey: process.env['INDO_TTS_API_KEY'] || undefined,
    };

    const registry = shouldUseMock(keys)
        ? createMockImageRegistry()
        : createImageRegistry(keys);

    // Generate image via fallback chain
    try {
        const { result, providerUsed, attempts } = await registry.generateImage({
            prompt: prompts.visualPrompt,
            referenceImages: visualProfile?.['referenceImages'],
            negativePrompt: prompts.negativePrompt,
            aspectRatio: '9:16',
        });

        return {
            resultUrl: result.url,
            providerUsed,
            providerAttempts: attempts,
            cost: result.cost ?? 0,
        };
    } catch (err) {
        rethrowChainExhausted(err);
    }
}

/**
 * Activity: Generate video clip (image-to-video) untuk satu shot.
 *
 * Alur:
 * 1. Resolve motion prompt (custom dari ShotSpec atau preset dari cameraAngle, VF-3.4)
 * 2. Buat MediaProviderRegistry (VF-3.3: Kling 3.0 → Seedance 2 → Wan 2.7)
 * 3. Panggil registry.generateVideoClip() — fallback chain otomatis
 * 4. Return result (url, providerUsed, attempts, cost)
 *
 * @param input.mediaAssetId ID MediaAsset di DB — dipakai idempotency guard
 * @param input.keyframeUrl URL keyframe image dari generateImage activity
 * @param input.shotSpec Shot spec dengan motionPrompt, cameraAngle, duration
 */
export async function generateVideoClip(input: {
    mediaAssetId: string;
    keyframeUrl: string;
    shotSpec: ShotSpec;
}): Promise<MediaGenerationResult> {
    const { mediaAssetId, keyframeUrl, shotSpec } = input;

    // Idempotency guard — lihat checkAlreadyDone() untuk penjelasan lengkap.
    const cached = await checkAlreadyDone(mediaAssetId);
    if (cached) return cached;

    // Validasi shot sebelum keluar uang ke provider (VF-3.2 style guide, VF-3 AC #1)
    validateShotOrThrow(shotSpec, undefined);

    // Resolve motion prompt (VF-3.4 camera-motion.ts)
    const motion = resolveMotionPrompt(
        shotSpec.motionPrompt,
        shotSpec.cameraAngle,
        shotSpec.duration,
    );

    // Setup registry — pakai mock kalau tidak ada API key
    const keys: MediaProviderKeyConfig = {
        falApiKey: process.env['FAL_API_KEY'] || undefined,
        geminiApiKey: process.env['GEMINI_API_KEY'] || undefined,
        elevenlabsApiKey: process.env['ELEVENLABS_API_KEY'] || undefined,
        cartesiaApiKey: process.env['CARTESIA_API_KEY'] || undefined,
        indoTtsBaseUrl: process.env['INDO_TTS_BASE_URL'] || undefined,
        indoTtsApiKey: process.env['INDO_TTS_API_KEY'] || undefined,
    };

    const registry = shouldUseMock(keys)
        ? createMockVideoRegistry()
        : createVideoRegistry(keys);

    // Generate video clip via fallback chain
    try {
        const { result, providerUsed, attempts } = await registry.generateVideoClip({
            keyframeUrl,
            motionPrompt: motion.prompt,
            duration: shotSpec.duration,
            aspectRatio: '9:16',
        });

        return {
            resultUrl: result.url,
            providerUsed,
            providerAttempts: attempts,
            cost: result.cost ?? 0,
        };
    } catch (err) {
        rethrowChainExhausted(err);
    }
}

/**
 * Activity: Generate voiceover (TTS) untuk satu shot (VF-4.1).
 *
 * Alur:
 * 1. Validasi shot punya dialogue
 * 2. Buat MediaProviderRegistry (VF-4.1: ElevenLabs → Cartesia → IndoTTS)
 * 3. Panggil registry.synthesizeVoice() — fallback chain otomatis
 * 4. Return result (url, providerUsed, attempts, cost)
 *
 * Voice profile dari CharacterAsset.voiceProfile — provider TIDAK boleh punya
 * default voice sendiri. Ini yang menjaga voice konsisten lintas episode
 * (VF-4 AC #2: "Voice karakter terdengar sama/konsisten di lebih dari satu episode").
 *
 * @param input.mediaAssetId ID MediaAsset di DB — dipakai idempotency guard
 * @param input.shotSpec Shot spec dengan dialogue (text + characterId)
 * @param input.voiceProfile Voice profile dari CharacterAsset
 */
export async function generateVoiceover(input: {
    mediaAssetId: string;
    shotSpec: ShotSpec;
    voiceProfile: {
        provider: string;
        voiceId: string;
        settings?: Record<string, unknown>;
    };
}): Promise<MediaGenerationResult> {
    const { mediaAssetId, shotSpec, voiceProfile } = input;

    // Idempotency guard — lihat checkAlreadyDone() untuk penjelasan lengkap.
    const cached = await checkAlreadyDone(mediaAssetId);
    if (cached) return cached;

    // Validasi: shot harus punya dialogue
    if (!shotSpec.dialogue) {
        throw ApplicationFailure.nonRetryable(
            `Shot ${shotSpec.index} has no dialogue — cannot generate voiceover`,
            'NoDialogue',
        );
    }

    // Setup registry — pakai mock kalau tidak ada API key
    const keys: MediaProviderKeyConfig = {
        falApiKey: process.env['FAL_API_KEY'] || undefined,
        geminiApiKey: process.env['GEMINI_API_KEY'] || undefined,
        elevenlabsApiKey: process.env['ELEVENLABS_API_KEY'] || undefined,
        cartesiaApiKey: process.env['CARTESIA_API_KEY'] || undefined,
        indoTtsBaseUrl: process.env['INDO_TTS_BASE_URL'] || undefined,
        indoTtsApiKey: process.env['INDO_TTS_API_KEY'] || undefined,
    };

    const registry = shouldUseMock(keys)
        ? createMockVoiceRegistry()
        : createVoiceRegistry(keys);

    // Generate voiceover via fallback chain
    try {
        const { result, providerUsed, attempts } = await registry.synthesizeVoice({
            text: shotSpec.dialogue.line,
            voiceId: voiceProfile.voiceId,
            settings: voiceProfile.settings,
        });

        return {
            resultUrl: result.url,
            providerUsed,
            providerAttempts: attempts,
            cost: result.cost ?? 0,
            // Return metadata for the workflow to store
            metadata: {
                duration: result.durationActual,
                characterId: shotSpec.dialogue.characterId,
                dialogueText: shotSpec.dialogue.line,
                voiceId: voiceProfile.voiceId,
            },
            subtype: 'VOICEOVER',
        };
    } catch (err) {
        rethrowChainExhausted(err);
    }
}
