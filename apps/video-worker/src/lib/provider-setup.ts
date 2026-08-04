/**
 * Suro-Buya Video Worker — Media Provider Registry Setup (VF-3.5)
 *
 * Membangun MediaProviderRegistry (VF-1.4/VF-3.1/VF-3.3) dengan API keys
 * dari environment variables. Dipakai oleh activities (media-generation.ts)
 * untuk generate image/video per shot.
 *
 * Pola: sama dengan apps/web API routes — API key di-inject dari env,
 * engine-v2 tidak baca env langsung (pola sejak VF-1.5). Video-worker
 * adalah aplikasi server yang sah untuk baca env dan inject ke provider.
 *
 * Fallback chains (locked di REDESIGN-VIDEO-FACTORY.md §4):
 * - Image: Nano Banana 2 (primary) → Flux 2 Pro (fallback)
 * - Video: Kling 3.0 (primary) → Seedance 2 (fallback 1) → Wan 2.7 (fallback 2)
 */

import {
    createImageProviderRegistry,
    createVideoProviderRegistry,
    MediaProviderRegistry,
    MockImageProvider,
    MockVideoProvider,
    type ImageProviderOptions,
    type VideoProviderOptions,
} from '@suro-buya/engine-v2';
import type { MediaProviderKeyConfig } from '../config.js';

/**
 * Buat registry untuk image provider dengan API keys dari config.
 * Chain: Nano Banana 2 (Gemini) → Flux 2 Pro (fal.ai).
 *
 * Kalau API key kosong, provider tetap terdaftar tapi isAvailable() return false —
 * fallback chain akan skip ke provider berikutnya (pola VF-1.4).
 */
export function createImageRegistry(
    keys: MediaProviderKeyConfig,
): MediaProviderRegistry {
    const nanoBanana2Opts: ImageProviderOptions = {
        apiKey: keys.geminiApiKey,
    };

    const flux2ProOpts: ImageProviderOptions = {
        apiKey: keys.falApiKey,
    };

    return createImageProviderRegistry({
        nanoBanana2: nanoBanana2Opts,
        flux2Pro: flux2ProOpts,
    });
}

/**
 * Buat registry untuk video provider dengan API keys dari config.
 * Chain: Kling 3.0 → Seedance 2 → Wan 2.7 (semua via fal.ai).
 *
 * Kalau FAL_API_KEY kosong, semua provider unavailable — chain langsung
 * throw MediaChainExhaustedError. Untuk testing tanpa API key, gunakan
 * mock registry (lihat createMockImageRegistry / createMockVideoRegistry).
 */
export function createVideoRegistry(
    keys: MediaProviderKeyConfig,
): MediaProviderRegistry {
    const sharedOpts: VideoProviderOptions = {
        apiKey: keys.falApiKey,
    };

    return createVideoProviderRegistry({
        kling3: sharedOpts,
        seedance2: sharedOpts,
        wan2_7: sharedOpts,
    });
}

/**
 * Buat registry dengan mock providers — dipakai untuk testing tanpa API key nyata.
 * Mock provider selalu available dan return URL dummy.
 */
export function createMockImageRegistry(): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();
    const mock = new MockImageProvider('mock-image-provider');
    registry.registerImageProvider(mock);
    registry.setImageChain([mock.name]);
    return registry;
}

/**
 * Buat registry dengan mock video provider — dipakai untuk testing.
 */
export function createMockVideoRegistry(): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();
    const mock = new MockVideoProvider('mock-video-provider');
    registry.registerVideoProvider(mock);
    registry.setVideoChain([mock.name]);
    return registry;
}