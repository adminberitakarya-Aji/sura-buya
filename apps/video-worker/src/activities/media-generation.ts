/**
 * Suro-Buya Video Worker — Media Generation Activities (VF-3.5)
 *
 * Activity untuk generate media (image/video) per shot via MediaProviderRegistry
 * (VF-1.4/VF-3.1/VF-3.3). Fallback chain di-handle oleh registry — activity
 * ini hanya memanggil registry dan return hasilnya.
 *
 * Temporal retry policy (DEFAULT_RETRY_POLICY di config.ts) meng-handle retry
 * untuk transient failures (network, rate limit, provider timeout). Kalau
 * seluruh fallback chain habis, MediaChainExhaustedError dilempar dan workflow
 * menandai MediaAsset sebagai FAILED.
 *
 * Resume-on-crash: kalau worker crash di tengah activity, Temporal akan
 * re-execute activity di worker lain — activity ini idempotent karena
 * generate media tidak punya side-effect selain memanggil provider API.
 */

import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';
import { buildAllPrompts } from '@suro-buya/engine-v2';
import { resolveMotionPrompt } from '@suro-buya/engine-v2';
import type { MediaGenerationResult } from '../shared/interfaces.js';
import {
    createImageRegistry,
    createVideoRegistry,
    createMockImageRegistry,
    createMockVideoRegistry,
} from '../lib/provider-setup.js';
import type { MediaProviderKeyConfig } from '../config.js';

/**
 * Cek apakah kita punya API keys nyata. Kalau tidak, pakai mock registry.
 * Ini memungkinkan worker berjalan di development tanpa API key, dan
 * testing tanpa mocking provider nyata.
 */
function shouldUseMock(keys: MediaProviderKeyConfig): boolean {
    return !keys.falApiKey && !keys.geminiApiKey;
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
 * @param input.shotSpec Shot spec dengan visualPrompt, cameraAngle, dll.
 * @param input.visualProfile Visual profile karakter (reference images, style tags)
 * @param input.artStyle Gaya visual opsional
 */
export async function generateImage(input: {
    shotSpec: ShotSpec;
    visualProfile?: Omit<CharacterVisualProfile, 'characterId'>;
    artStyle?: string;
}): Promise<MediaGenerationResult> {
    const { shotSpec, visualProfile, artStyle } = input;

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
    };

    const registry = shouldUseMock(keys)
        ? createMockImageRegistry()
        : createImageRegistry(keys);

    // Generate image via fallback chain
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
 * @param input.keyframeUrl URL keyframe image dari generateImage activity
 * @param input.shotSpec Shot spec dengan motionPrompt, cameraAngle, duration
 */
export async function generateVideoClip(input: {
    keyframeUrl: string;
    shotSpec: ShotSpec;
}): Promise<MediaGenerationResult> {
    const { keyframeUrl, shotSpec } = input;

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
    };

    const registry = shouldUseMock(keys)
        ? createMockVideoRegistry()
        : createVideoRegistry(keys);

    // Generate video clip via fallback chain
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
}