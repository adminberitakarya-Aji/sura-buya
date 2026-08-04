/**
 * Suro-Buya Engine v2 - Image Generator (VF-3.2)
 *
 * Per-shot keyframe generation — ambil ShotSpec[] (storyboard dari VF-2.5),
 * build prompt per shot (pakai prompt-builder VF-2.5), dan generate keyframe
 * image via ImageProvider / MediaProviderRegistry (VF-3.1).
 *
 * Sebelum generate, jalankan style-guide-enforcer (VF-3.2) untuk validasi
 * konsistensi gaya visual lintas shot — ini yang menjaga karakter terlihat
 * konsisten visual di seluruh shot (VF-3 Acceptance Criteria #1).
 *
 * PENTING: modul ini adalah orchestrator — tidak menyentuh Prisma/DB.
 * Hasilnya (GeneratedKeyframe[]) dikonsumsi caller (API route di apps/web)
 * yang bertanggung jawab simpan ke MediaAsset (VF-3.6). Pola yang sama
 * dengan reference-generator.ts (VF-1.6): engine-v2 generate, apps/web persist.
 */

import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';
import { buildAllPrompts } from '../storyboard/prompt-builder.js';
import { MediaProviderRegistry } from '../ai/media-providers/registry.js';
import { MockImageProvider } from '../ai/media-providers/mock-providers.js';
import {
    enforceStyleGuide,
    type StyleGuideEnforcementResult,
} from './style-guide-enforcer.js';

/**
 * Input untuk generate keyframes.
 */
export interface ImageGeneratorInput {
    /** Shot list dari storyboard (VF-2.5 scene-breakdown) */
    shots: ShotSpec[];

    /** Visual profile karakter dari CharacterAsset (VF-1.1) */
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;

    /** Gaya visual opsional, mis. "2D digital, watercolor" */
    artStyle?: string;

    /** Registry dengan image provider sudah terdaftar. Kalau tidak disuplai, pakai mock default. */
    registry?: MediaProviderRegistry;

    /** Aspect ratio target. Default: 9:16 (vertical short-form video) */
    aspectRatio?: '9:16' | '16:9' | '1:1';

    /**
     * Kalau true, generate shot secara sequential (default, aman dari rate limit).
     * Kalau false, generate paralel (cepat tapi berisiko rate limit di provider).
     */
    sequential?: boolean;
}

/**
 * Satu keyframe yang sudah digenerate.
 */
export interface GeneratedKeyframe {
    /** Index shot dalam storyboard (ShotSpec.index) */
    shotIndex: number;

    /** URL gambar hasil generate (data URL atau hosted URL tergantung provider) */
    imageUrl: string;

    /** Nama provider yang berhasil (mis. "nano-banana-2" atau "flux-2-pro") */
    providerUsed: string;

    /** Biaya generate ini dalam USD */
    cost: number;

    /** Prompt yang dipakai untuk generate (dari prompt-builder VF-2.5) */
    promptUsed: string;

    /** Daftar provider yang dicoba (termasuk yang gagal) — untuk debugging */
    attempts: string[];
}

/**
 * Hasil generate keyframes.
 */
export interface ImageGeneratorResult {
    /** Keyframe per shot */
    keyframes: GeneratedKeyframe[];

    /** Total biaya semua keyframe dalam USD */
    totalCost: number;

    /** Provider yang dipakai untuk shot terakhir (untuk logging) */
    providerUsed: string;

    /** Warning dari style-guide enforcer dan proses generate */
    warnings: string[];

    /** Hasil style-guide enforcement (VF-3.2) */
    styleGuideResult: StyleGuideEnforcementResult;
}

/**
 * Error yang dilempar saat generate keyframes gagal.
 */
export class ImageGeneratorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImageGeneratorError';
    }
}

/**
 * Generate keyframe image untuk satu shot.
 *
 * @param shot Shot spec
 * @param visualProfile Visual profile karakter
 * @param artStyle Gaya visual opsional
 * @param registry Media provider registry
 * @param aspectRatio Aspect ratio target
 * @returns Generated keyframe
 */
async function generateSingleKeyframe(
    shot: ShotSpec,
    visualProfile: Omit<CharacterVisualProfile, 'characterId'> | undefined,
    artStyle: string | undefined,
    registry: MediaProviderRegistry,
    aspectRatio: '9:16' | '16:9' | '1:1',
): Promise<GeneratedKeyframe> {
    // Build prompts untuk shot ini (VF-2.5)
    const prompts = buildAllPrompts({
        shot,
        visualProfile,
        artStyle,
    });

    // Create image generation request
    const { result, providerUsed, attempts } = await registry.generateImage({
        prompt: prompts.visualPrompt,
        referenceImages: visualProfile?.referenceImages,
        negativePrompt: prompts.negativePrompt,
        aspectRatio,
    });

    return {
        shotIndex: shot.index,
        imageUrl: result.url,
        providerUsed,
        cost: result.cost ?? 0,
        promptUsed: prompts.visualPrompt,
        attempts,
    };
}

/**
 * Generate keyframe images untuk semua shot dalam storyboard.
 *
 * Alur:
 * 1. Validasi input (shots tidak kosong)
 * 2. Jalankan style-guide enforcer (VF-3.2) — cek konsistensi visual
 * 3. Kalau ada error severity violation, throw (jangan generate)
 * 4. Kalau hanya warning, lanjut generate dengan warnings di result
 * 5. Untuk setiap shot, build prompt (VF-2.5) → generate image (VF-3.1)
 * 6. Track cost per keyframe dan total
 *
 * @param input Shots + visual profile + registry
 * @returns Generated keyframes + metadata
 */
export async function generateKeyframes(
    input: ImageGeneratorInput,
): Promise<ImageGeneratorResult> {
    // --- Validate input ---
    if (!input.shots || input.shots.length === 0) {
        throw new ImageGeneratorError(
            'Cannot generate keyframes: shots list is empty. Generate storyboard first (VF-2.5).',
        );
    }

    // --- Run style-guide enforcer ---
    const styleGuideResult = enforceStyleGuide(
        input.shots,
        input.visualProfile,
    );

    if (!styleGuideResult.passed) {
        const errorCount = styleGuideResult.violations.filter(
            (v) => v.severity === 'error',
        ).length;
        throw new ImageGeneratorError(
            `Style guide enforcement failed: ${errorCount} error(s) found. ` +
                'Fix storyboard before generating keyframes. ' +
                `Violations: ${styleGuideResult.violations
                    .filter((v) => v.severity === 'error')
                    .map((v) => `Shot ${v.shotIndex} ${v.field}: ${v.message}`)
                    .join('; ')}`,
        );
    }

    // --- Set up registry ---
    let registry = input.registry;
    if (!registry) {
        // Default fallback: mock provider (untuk testing tanpa API key nyata)
        registry = new MediaProviderRegistry();
        const mockProvider = new MockImageProvider('flux-2-pro');
        registry.registerImageProvider(mockProvider);
        registry.setImageChain(['flux-2-pro']);
    }

    const aspectRatio = input.aspectRatio ?? '9:16';
    const sequential = input.sequential ?? true; // default sequential (safe)

    const keyframes: GeneratedKeyframe[] = [];
    const warnings: string[] = [...styleGuideResult.recommendations];
    let totalCost = 0;
    let lastProviderUsed = '';

    // --- Generate keyframes ---
    if (sequential) {
        // Sequential: satu per satu (aman dari rate limit)
        for (const shot of input.shots) {
            const keyframe = await generateSingleKeyframe(
                shot,
                input.visualProfile,
                input.artStyle,
                registry,
                aspectRatio,
            );
            keyframes.push(keyframe);
            totalCost += keyframe.cost;
            lastProviderUsed = keyframe.providerUsed;
        }
    } else {
        // Parallel: semua sekaligus (cepat tapi berisiko rate limit)
        const results = await Promise.all(
            input.shots.map((shot) =>
                generateSingleKeyframe(
                    shot,
                    input.visualProfile,
                    input.artStyle,
                    registry,
                    aspectRatio,
                ),
            ),
        );
        for (const keyframe of results) {
            keyframes.push(keyframe);
            totalCost += keyframe.cost;
            lastProviderUsed = keyframe.providerUsed;
        }
    }

    // Sort by shot index (penting untuk parallel mode yang tidak menjamin urutan)
    keyframes.sort((a, b) => a.shotIndex - b.shotIndex);

    return {
        keyframes,
        totalCost: Math.round(totalCost * 10000) / 10000,
        providerUsed: lastProviderUsed,
        warnings,
        styleGuideResult,
    };
}