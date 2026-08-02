/**
 * Suro-Buya Engine v2 - Media Provider Registry (VF-1.4)
 *
 * BEDA dari `ai/registry.ts` (ProviderRegistry teks, primary/fallback
 * tunggal): registry ini menjalankan fallback CHAIN — daftar provider
 * berurutan yang dicoba satu per satu sampai ada yang berhasil. Ini sesuai
 * keputusan locked di REDESIGN-VIDEO-FACTORY.md §4 (mis. Video Gen Provider:
 * Kling 3.0 → Seedance 2 → Wan 2.7).
 *
 * Di VF-1.4 registry ini baru mengelola MOCK provider (lihat
 * mock-providers.ts). Implementasi provider nyata masuk di VF-3.1 (image),
 * VF-3.3 (video), VF-4.1 (voice) — registry ini TIDAK perlu diubah saat itu
 * terjadi, cukup registrasi provider baru + set chain-nya.
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
import { MediaChainExhaustedError } from './types.js';

/** Kontrak minimal yang dibutuhkan executeChain — ketiga jenis provider (Image/Video/Voice) sama-sama punya name + isAvailable() */
interface ChainableProvider {
    readonly name: string;
    isAvailable(): Promise<boolean>;
}

/** Hasil eksekusi chain — providerUsed & attempts dipetakan langsung ke field MediaJob di @suro-buya/shared oleh caller (VF-3.5, Temporal workflow) */
export interface ChainExecutionResult<TResult> {
    result: TResult;
    providerUsed: string;
    /** Semua provider yang DICOBA (termasuk yang gagal), berurutan sesuai chain */
    attempts: string[];
}

export class MediaProviderRegistry {
    private imageProviders = new Map<string, ImageProvider>();
    private videoProviders = new Map<string, VideoProvider>();
    private voiceProviders = new Map<string, VoiceProvider>();

    private imageChain: string[] = [];
    private videoChain: string[] = [];
    private voiceChain: string[] = [];

    registerImageProvider(provider: ImageProvider): void {
        this.imageProviders.set(provider.name, provider);
    }

    registerVideoProvider(provider: VideoProvider): void {
        this.videoProviders.set(provider.name, provider);
    }

    registerVoiceProvider(provider: VoiceProvider): void {
        this.voiceProviders.set(provider.name, provider);
    }

    /** Urutan fallback, mis. `['kling-3.0', 'seedance-2', 'wan-2.7']` — nama harus sudah diregistrasi lewat registerVideoProvider() */
    setImageChain(providerNames: string[]): void {
        this.imageChain = providerNames;
    }

    setVideoChain(providerNames: string[]): void {
        this.videoChain = providerNames;
    }

    setVoiceChain(providerNames: string[]): void {
        this.voiceChain = providerNames;
    }

    async generateImage(
        request: ImageGenerationRequest,
    ): Promise<ChainExecutionResult<ImageGenerationResult>> {
        return this.executeChain(this.imageChain, this.imageProviders, (provider) =>
            provider.generateImage(request),
        );
    }

    async generateVideoClip(
        request: VideoGenerationRequest,
    ): Promise<ChainExecutionResult<VideoGenerationResult>> {
        return this.executeChain(this.videoChain, this.videoProviders, (provider) =>
            provider.generateClip(request),
        );
    }

    async synthesizeVoice(
        request: VoiceSynthesisRequest,
    ): Promise<ChainExecutionResult<VoiceSynthesisResult>> {
        return this.executeChain(this.voiceChain, this.voiceProviders, (provider) =>
            provider.synthesize(request),
        );
    }

    /**
     * Coba tiap provider di chain berurutan. Provider yang tidak terdaftar
     * atau gagal (`isAvailable()` false ATAU generate melempar error) di-skip
     * ke provider berikutnya — TIDAK menghentikan seluruh chain, kecuali
     * semua provider di chain sudah dicoba dan gagal semua.
     */
    private async executeChain<TProvider extends ChainableProvider, TResult>(
        chain: string[],
        providers: Map<string, TProvider>,
        execute: (provider: TProvider) => Promise<TResult>,
    ): Promise<ChainExecutionResult<TResult>> {
        if (chain.length === 0) {
            throw new Error(
                'Fallback chain kosong — panggil setImageChain()/setVideoChain()/setVoiceChain() dulu sebelum generate.',
            );
        }

        const attempts: string[] = [];
        const errors: { providerName: string; error: string }[] = [];

        for (const name of chain) {
            const provider = providers.get(name);
            if (!provider) {
                errors.push({
                    providerName: name,
                    error: 'Provider tidak terdaftar (belum dipanggil registerXProvider sebelum generate)',
                });
                continue;
            }

            attempts.push(name);

            try {
                const available = await provider.isAvailable();
                if (!available) {
                    errors.push({ providerName: name, error: 'Provider melaporkan tidak tersedia (isAvailable() = false)' });
                    continue;
                }

                const result = await execute(provider);
                return { result, providerUsed: name, attempts };
            } catch (err) {
                errors.push({
                    providerName: name,
                    error: err instanceof Error ? err.message : String(err),
                });
                continue; // lanjut ke provider berikutnya di chain, JANGAN throw di sini
            }
        }

        throw new MediaChainExhaustedError(
            `Semua provider di fallback chain gagal: ${chain.join(' → ')}`,
            errors,
        );
    }
}