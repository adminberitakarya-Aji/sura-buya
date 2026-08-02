/**
 * Suro-Buya Engine v2 - Mock Media Providers (VF-1.4)
 *
 * Placeholder implementasi ImageProvider/VideoProvider/VoiceProvider.
 * TIDAK memanggil API eksternal apapun — dipakai untuk:
 * 1. Menguji logika fallback chain di `MediaProviderRegistry` secara deterministik
 * 2. Placeholder sampai implementasi nyata masuk (Nano Banana 2/Flux 2 Pro di
 *    VF-3.1, Kling 3.0/Seedance 2/Wan 2.7 di VF-3.3, ElevenLabs/Cartesia di VF-4.1)
 *
 * `shouldFail` dipakai test untuk mensimulasikan provider yang gagal/down,
 * supaya perilaku fallback chain bisa diuji tanpa mocking jaringan.
 */

import type {
    ImageProvider,
    ImageGenerationRequest,
    ImageGenerationResult,
    VideoProvider,
    VideoGenerationRequest,
    VideoGenerationResult,
    VoiceProvider,
    VoiceSynthesisRequest,
    VoiceSynthesisResult,
} from './types.js';
import { MediaProviderError } from './types.js';

export class MockImageProvider implements ImageProvider {
    constructor(
        public readonly name: string,
        private readonly shouldFail = false,
    ) { }

    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
        if (this.shouldFail) {
            throw new MediaProviderError(`Mock provider ${this.name} sengaja disetel gagal`, this.name);
        }
        return {
            url: `https://mock-media.local/image/${this.name}/${encodeURIComponent(request.prompt).slice(0, 40)}.png`,
            providerName: this.name,
            cost: 0.01,
        };
    }

    async isAvailable(): Promise<boolean> {
        return !this.shouldFail;
    }
}

export class MockVideoProvider implements VideoProvider {
    constructor(
        public readonly name: string,
        private readonly shouldFail = false,
    ) { }

    async generateClip(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
        if (this.shouldFail) {
            throw new MediaProviderError(`Mock provider ${this.name} sengaja disetel gagal`, this.name);
        }
        return {
            url: `https://mock-media.local/video/${this.name}/clip.mp4`,
            providerName: this.name,
            durationActual: request.duration,
            cost: 0.05,
        };
    }

    async isAvailable(): Promise<boolean> {
        return !this.shouldFail;
    }
}

export class MockVoiceProvider implements VoiceProvider {
    constructor(
        public readonly name: string,
        private readonly shouldFail = false,
    ) { }

    async synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
        if (this.shouldFail) {
            throw new MediaProviderError(`Mock provider ${this.name} sengaja disetel gagal`, this.name);
        }
        // Estimasi kasar durasi dari panjang teks — cukup untuk keperluan mock/test
        const estimatedDuration = Math.max(1, request.text.split(/\s+/).length / 2.5);
        return {
            url: `https://mock-media.local/voice/${this.name}/${request.voiceId}.mp3`,
            providerName: this.name,
            durationActual: estimatedDuration,
            cost: 0.002,
        };
    }

    async isAvailable(): Promise<boolean> {
        return !this.shouldFail;
    }
}