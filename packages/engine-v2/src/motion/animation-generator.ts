/**
 * Suro-Buya Engine v2 - Animation Generator (VF-3.4)
 *
 * Image-to-video per shot — ambil GeneratedKeyframe[] (dari image-generator VF-3.2)
 * + ShotSpec[] (storyboard VF-2.5), dan generate video clip per shot via
 * VideoProvider / MediaProviderRegistry (VF-3.3).
 *
 * Sebelum generate, resolve motion prompt per shot: kalau ShotSpec.motionPrompt
 * sudah di-set (custom), pakai itu. Kalau tidak, pakai preset berdasarkan
 * cameraAngle (cost optimization — lihat camera-motion.ts).
 *
 * PENTING: modul ini adalah orchestrator — tidak menyentuh Prisma/DB.
 * Hasilnya (GeneratedClip[]) dikonsumsi caller (API route di apps/web)
 * yang bertanggung jawab simpan ke MediaAsset (VF-3.6). Pola yang sama
 * dengan image-generator.ts (VF-3.2): engine-v2 generate, apps/web persist.
 */

import type { ShotSpec } from '@suro-buya/shared';
import type { GeneratedKeyframe } from '../visual/image-generator.js';
import { MediaProviderRegistry } from '../ai/media-providers/registry.js';
import { MockVideoProvider } from '../ai/media-providers/mock-providers.js';
import {
    resolveMotionPrompt,
    type CameraMotionPreset,
    type MotionCostTier,
} from './camera-motion.js';

/**
 * Input untuk generate animations (video clips).
 */
export interface AnimationGeneratorInput {
    /** Shot list dari storyboard (VF-2.5) */
    shots: ShotSpec[];

    /** Keyframe images dari image-generator (VF-3.2) — harus match shots by shotIndex */
    keyframes: GeneratedKeyframe[];

    /** Registry dengan video provider sudah terdaftar. Kalau tidak disuplai, pakai mock default. */
    registry?: MediaProviderRegistry;

    /** Aspect ratio target. Default: 9:16 (vertical short-form video) */
    aspectRatio?: '9:16' | '16:9' | '1:1';

    /**
     * Kalau true, generate clip secara sequential (default, aman dari rate limit).
     * Kalau false, generate paralel (cepat tapi berisiko rate limit).
     */
    sequential?: boolean;
}

/**
 * Satu video clip yang sudah digenerate.
 */
export interface GeneratedClip {
    /** Index shot dalam storyboard (ShotSpec.index) */
    shotIndex: number;

    /** URL video clip hasil generate */
    clipUrl: string;

    /** Nama provider yang berhasil (mis. "kling-3.0" atau "wan-2.7") */
    providerUsed: string;

    /** Biaya generate ini dalam USD */
    cost: number;

    /** Durasi aktual clip dalam detik */
    durationActual: number;

    /** Motion prompt yang dipakai untuk generate */
    motionPromptUsed: string;

    /** Preset yang dipakai (kalau custom, 'dynamic') */
    presetUsed: CameraMotionPreset;

    /** Cost tier dari preset (untuk cost analysis) */
    costTier: MotionCostTier;

    /** Apakah motion prompt custom (dari ShotSpec) atau preset (dari cameraAngle) */
    isCustomMotion: boolean;

    /** Daftar provider yang dicoba (termasuk yang gagal) — untuk debugging */
    attempts: string[];
}

/**
 * Hasil generate animations.
 */
export interface AnimationGeneratorResult {
    /** Video clip per shot */
    clips: GeneratedClip[];

    /** Total biaya semua clip dalam USD */
    totalCost: number;

    /** Provider yang dipakai untuk shot terakhir (untuk logging) */
    providerUsed: string;

    /** Warning dari proses generate */
    warnings: string[];

    /** Ringkasan cost tier distribution (untuk cost analysis) */
    costTierSummary: {
        low: number;
        medium: number;
        high: number;
    };
}

/**
 * Error yang dilempar saat generate animations gagal.
 */
export class AnimationGeneratorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AnimationGeneratorError';
    }
}

/**
 * Generate video clip untuk satu shot.
 *
 * @param shot Shot spec
 * @param keyframe Keyframe image untuk shot ini
 * @param registry Media provider registry
 * @param aspectRatio Aspect ratio target
 * @returns Generated clip
 */
async function generateSingleClip(
    shot: ShotSpec,
    keyframe: GeneratedKeyframe,
    registry: MediaProviderRegistry,
    aspectRatio: '9:16' | '16:9' | '1:1',
): Promise<GeneratedClip> {
    // Resolve motion prompt: custom dari ShotSpec atau preset dari cameraAngle
    const motion = resolveMotionPrompt(
        shot.motionPrompt,
        shot.cameraAngle,
        shot.duration,
    );

    // Create video generation request
    const { result, providerUsed, attempts } = await registry.generateVideoClip({
        keyframeUrl: keyframe.imageUrl,
        motionPrompt: motion.prompt,
        duration: shot.duration,
        aspectRatio,
    });

    return {
        shotIndex: shot.index,
        clipUrl: result.url,
        providerUsed,
        cost: result.cost ?? 0,
        durationActual: result.durationActual,
        motionPromptUsed: motion.prompt,
        presetUsed: motion.preset,
        costTier: motion.costTier,
        isCustomMotion: motion.isCustom,
        attempts,
    };
}

/**
 * Validasi bahwa keyframes match shots (count dan shotIndex).
 */
function validateKeyframeShotMatch(
    shots: ShotSpec[],
    keyframes: GeneratedKeyframe[],
): void {
    if (keyframes.length === 0) {
        throw new AnimationGeneratorError(
            'Cannot generate animations: keyframes list is empty. Generate keyframes first (VF-3.2).',
        );
    }

    if (shots.length !== keyframes.length) {
        throw new AnimationGeneratorError(
            `Shot count (${shots.length}) does not match keyframe count (${keyframes.length}). ` +
                'Both must be generated from the same storyboard.',
        );
    }

    // Build keyframe index map for quick lookup
    const keyframeMap = new Map(keyframes.map((k) => [k.shotIndex, k]));

    for (const shot of shots) {
        if (!keyframeMap.has(shot.index)) {
            throw new AnimationGeneratorError(
                `No keyframe found for shot ${shot.index}. ` +
                    'Ensure keyframes are generated for all shots before animation.',
            );
        }
    }
}

/**
 * Generate video clips untuk semua shot dalam storyboard.
 *
 * Alur:
 * 1. Validasi input (shots tidak kosong, keyframes match shots)
 * 2. Untuk setiap shot, resolve motion prompt (custom atau preset)
 * 3. Generate video clip via VideoProvider/MediaProviderRegistry (VF-3.3)
 * 4. Track cost per clip dan total
 * 5. Build cost tier summary untuk cost analysis
 *
 * @param input Shots + keyframes + registry
 * @returns Generated clips + metadata
 */
export async function generateAnimations(
    input: AnimationGeneratorInput,
): Promise<AnimationGeneratorResult> {
    // --- Validate input ---
    if (!input.shots || input.shots.length === 0) {
        throw new AnimationGeneratorError(
            'Cannot generate animations: shots list is empty. Generate storyboard first (VF-2.5).',
        );
    }

    // --- Validate keyframe-shot match ---
    validateKeyframeShotMatch(input.shots, input.keyframes);

    // --- Set up registry ---
    let registry = input.registry;
    if (!registry) {
        // Default fallback: mock provider (untuk testing tanpa API key nyata)
        registry = new MediaProviderRegistry();
        const mockProvider = new MockVideoProvider('kling-3.0');
        registry.registerVideoProvider(mockProvider);
        registry.setVideoChain(['kling-3.0']);
    }

    const aspectRatio = input.aspectRatio ?? '9:16';
    const sequential = input.sequential ?? true; // default sequential (safe)

    // Build keyframe index map for quick lookup
    const keyframeMap = new Map(input.keyframes.map((k) => [k.shotIndex, k]));

    const clips: GeneratedClip[] = [];
    const warnings: string[] = [];
    let totalCost = 0;
    let lastProviderUsed = '';

    // --- Generate clips ---
    if (sequential) {
        // Sequential: satu per satu (aman dari rate limit)
        for (const shot of input.shots) {
            const keyframe = keyframeMap.get(shot.index)!;
            const clip = await generateSingleClip(
                shot,
                keyframe,
                registry,
                aspectRatio,
            );
            clips.push(clip);
            totalCost += clip.cost;
            lastProviderUsed = clip.providerUsed;
        }
    } else {
        // Parallel: semua sekaligus (cepat tapi berisiko rate limit)
        const results = await Promise.all(
            input.shots.map((shot) => {
                const keyframe = keyframeMap.get(shot.index)!;
                return generateSingleClip(shot, keyframe, registry, aspectRatio);
            }),
        );
        for (const clip of results) {
            clips.push(clip);
            totalCost += clip.cost;
            lastProviderUsed = clip.providerUsed;
        }
    }

    // Sort by shot index (penting untuk parallel mode)
    clips.sort((a, b) => a.shotIndex - b.shotIndex);

    // --- Build cost tier summary ---
    const costTierSummary = {
        low: clips.filter((c) => c.costTier === 'low').length,
        medium: clips.filter((c) => c.costTier === 'medium').length,
        high: clips.filter((c) => c.costTier === 'high').length,
    };

    // --- Add cost optimization warnings ---
    const customCount = clips.filter((c) => c.isCustomMotion).length;
    if (customCount > 0) {
        warnings.push(
            `${customCount} shot(s) use custom motion prompts (high cost tier). ` +
                'Consider using camera-angle presets for cost optimization.',
        );
    }

    const highCostCount = costTierSummary.high;
    if (highCostCount > clips.length * 0.5) {
        warnings.push(
            `${highCostCount} of ${clips.length} clips are in high cost tier. ` +
                'Consider simplifying motion prompts to reduce cost.',
        );
    }

    return {
        clips,
        totalCost: Math.round(totalCost * 10000) / 10000,
        providerUsed: lastProviderUsed,
        warnings,
        costTierSummary,
    };
}