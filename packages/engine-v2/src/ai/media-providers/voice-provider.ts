/**
 * Suro-Buya Engine v2 - Voice Provider Implementations (VF-4.1)
 *
 * Real implementations of VoiceProvider for TTS (text-to-speech):
 * - ElevenLabs (primary) — unggul kualitas suara natural, support multilingual
 *   termasuk Bahasa Indonesia, voice cloning capability
 * - Cartesia (fallback 1) — low-latency TTS, natural sound, support Bahasa Indonesia
 * - IndoTTS (fallback 2) — provider lokal Indonesia, cost optimization
 *   (opsional self-host di VF-6 untuk cost optimization)
 *
 * Fallback chain: ElevenLabs → Cartesia → IndoTTS
 * (REDESIGN-VIDEO-FACTORY.md §4: "ElevenLabs/Cartesia (primary, wajib uji kualitas
 * Bahasa Indonesia untuk rentang suara yang dibutuhkan tiap universe) + IndoTTS (fallback)")
 *
 * Semua provider menerima voiceId dari CharacterAsset.voiceProfile —
 * provider TIDAK boleh punya default voice sendiri di luar yang dikonfigurasi
 * per-karakter. Ini yang menjaga voice konsisten lintas episode (VF-4 AC #2).
 *
 * Pola: sama dengan image-provider.ts (VF-3.1) dan video-provider.ts (VF-3.3) —
 * API key via constructor, engine-v2 tidak baca env langsung.
 */

import type {
    VoiceProvider,
    VoiceSynthesisRequest,
    VoiceSynthesisResult,
} from './types.js';
import { MediaProviderError } from './types.js';
import { MediaProviderRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Common Options
// ---------------------------------------------------------------------------

/**
 * Konfigurasi untuk voice provider nyata. Sama seperti VideoProviderOptions
 * (VF-3.3) — apiKey wajib diisi oleh caller dari environment variable.
 */
export interface VoiceProviderOptions {
    /** API key untuk provider (wajib untuk operasi nyata). */
    apiKey?: string;
    /** Base URL API, bisa di-override untuk testing/proxy/self-host. */
    baseUrl?: string;
    /** Biaya default per sintesis voice dalam USD. */
    defaultCostUsd?: number;
    /** Timeout request dalam ms. Default: 60000 (1 menit — TTS jauh lebih cepat dari video gen). */
    timeoutMs?: number;
    /** Model/voice ID default kalau CharacterAsset.voiceProfile tidak specify. */
    defaultModel?: string;
}

// ---------------------------------------------------------------------------
// ElevenLabs (primary)
// ---------------------------------------------------------------------------

/**
 * ElevenLabs — provider TTS primary.
 *
 * Unggul kualitas suara natural, support multilingual termasuk Bahasa Indonesia.
 * Voice cloning capability memungkinkan voice konsisten lintas episode
 * (VF-4 Acceptance Criteria #2: "Voice karakter terdengar sama/konsisten di
 * lebih dari satu episode").
 *
 * API: ElevenLabs REST API
 * Endpoint: https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 * Auth: API key via "xi-api-key" header
 *
 * Return: audio/mpeg URL (hosted oleh ElevenLabs) atau base64 data URL.
 */
export class ElevenLabsProvider implements VoiceProvider {
    readonly name = 'elevenlabs';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;
    private readonly defaultModel: string;

    constructor(options: VoiceProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl = options.baseUrl ?? 'https://api.elevenlabs.io/v1';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.003; // ~$0.30 per 1000 chars
        this.timeoutMs = options.timeoutMs ?? 60000;
        this.defaultModel = options.defaultModel ?? 'eleven_multilingual_v2';
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async synthesize(
        request: VoiceSynthesisRequest,
    ): Promise<VoiceSynthesisResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'ElevenLabs API key not configured — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            const model = (request.settings?.['model'] as string) ?? this.defaultModel;
            const stability = (request.settings?.['stability'] as number) ?? 0.5;
            const similarityBoost = (request.settings?.['similarityBoost'] as number) ?? 0.75;
            const style = (request.settings?.['style'] as number) ?? 0;
            const useSpeakerBoost = (request.settings?.['useSpeakerBoost'] as boolean) ?? true;

            const response = await fetch(
                `${this.baseUrl}/text-to-speech/${request.voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey,
                        Accept: 'audio/mpeg',
                    },
                    body: JSON.stringify({
                        text: request.text,
                        model_id: model,
                        voice_settings: {
                            stability,
                            similarity_boost: similarityBoost,
                            style,
                            use_speaker_boost: useSpeakerBoost,
                        },
                    }),
                    signal: AbortSignal.timeout(this.timeoutMs),
                },
            );

            if (!response.ok) {
                const errorText = await response
                    .text()
                    .catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `ElevenLabs API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            // ElevenLabs returns audio binary — convert to base64 data URL
            const audioBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(audioBuffer).toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${base64}`;

            // Estimate duration: ~150 words per minute = 2.5 words per second
            const wordCount = request.text.split(/\s+/).length;
            const estimatedDuration = Math.max(1, wordCount / 2.5);

            return {
                url: audioDataUrl,
                providerName: this.name,
                durationActual: estimatedDuration,
                cost: this.defaultCostUsd,
                raw: {
                    model,
                    voiceId: request.voiceId,
                    characters: request.text.length,
                },
            };
        } catch (err) {
            if (err instanceof MediaProviderError) {
                throw err;
            }
            const message =
                err instanceof Error ? err.message : String(err);
            const isTimeout =
                err instanceof Error && err.name === 'TimeoutError';
            throw new MediaProviderError(
                isTimeout
                    ? `ElevenLabs request timed out after ${this.timeoutMs}ms`
                    : `ElevenLabs request failed: ${message}`,
                this.name,
                err,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Cartesia (fallback 1)
// ---------------------------------------------------------------------------

/**
 * Cartesia — provider TTS fallback pertama.
 *
 * Low-latency TTS dengan kualitas natural, support Bahasa Indonesia.
 * Dipakai kalau ElevenLabs gagal atau unavailable.
 *
 * API: Cartesia REST API
 * Endpoint: https://api.cartesia.ai/tts/bytes
 * Auth: API key via "x-api-key" header
 *
 * Return: audio/mpeg binary (converted to base64 data URL).
 */
export class CartesiaProvider implements VoiceProvider {
    readonly name = 'cartesia';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;
    private readonly defaultModel: string;

    constructor(options: VoiceProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl = options.baseUrl ?? 'https://api.cartesia.ai';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.002; // slightly cheaper than ElevenLabs
        this.timeoutMs = options.timeoutMs ?? 60000;
        this.defaultModel = options.defaultModel ?? 'sonic-2';
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async synthesize(
        request: VoiceSynthesisRequest,
    ): Promise<VoiceSynthesisResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'Cartesia API key not configured — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            const model = (request.settings?.['model'] as string) ?? this.defaultModel;
            const speed = (request.settings?.['speed'] as number) ?? 1.0;
            const emotion = (request.settings?.['emotion'] as string) ?? 'neutral';

            const response = await fetch(`${this.baseUrl}/tts/bytes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    Accept: 'audio/mpeg',
                },
                body: JSON.stringify({
                    model_id: model,
                    transcript: request.text,
                    voice: {
                        voice_id: request.voiceId,
                    },
                    output_format: {
                        container: 'mp3',
                        sample_rate: 44100,
                    },
                    speed,
                    emotion,
                }),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!response.ok) {
                const errorText = await response
                    .text()
                    .catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `Cartesia API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            // Cartesia returns audio binary — convert to base64 data URL
            const audioBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(audioBuffer).toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${base64}`;

            // Estimate duration
            const wordCount = request.text.split(/\s+/).length;
            const estimatedDuration = Math.max(1, wordCount / 2.5);

            return {
                url: audioDataUrl,
                providerName: this.name,
                durationActual: estimatedDuration,
                cost: this.defaultCostUsd,
                raw: {
                    model,
                    voiceId: request.voiceId,
                    characters: request.text.length,
                },
            };
        } catch (err) {
            if (err instanceof MediaProviderError) {
                throw err;
            }
            const message =
                err instanceof Error ? err.message : String(err);
            const isTimeout =
                err instanceof Error && err.name === 'TimeoutError';
            throw new MediaProviderError(
                isTimeout
                    ? `Cartesia request timed out after ${this.timeoutMs}ms`
                    : `Cartesia request failed: ${message}`,
                this.name,
                err,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// IndoTTS (fallback 2 — cost optimization, opsional self-host di VF-6)
// ---------------------------------------------------------------------------

/**
 * IndoTTS — provider TTS fallback terakhir, fokus Bahasa Indonesia.
 *
 * Provider lokal Indonesia, cost optimization option. Dipakai kalau ElevenLabs
 * dan Cartesia keduanya gagal. Di VF-6, IndoTTS bisa di-self-host untuk
 * cost optimization (REDESIGN-VIDEO-FACTORY.md §10: "Wan 2.7 self-host &
 * IndoTTS sebagai cost lever VF-6").
 *
 * API: IndoTTS REST API (self-hosted atau hosted)
 * Endpoint: configurable via baseUrl
 * Auth: API key via "Authorization: Bearer" header (opsional untuk self-host)
 *
 * Return: audio/wav binary (converted to base64 data URL).
 */
export class IndoTTSProvider implements VoiceProvider {
    readonly name = 'indo-tts';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;
    private readonly defaultModel: string;

    constructor(options: VoiceProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl = options.baseUrl ?? 'http://localhost:8000';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.001; // cheapest option
        this.timeoutMs = options.timeoutMs ?? 60000;
        this.defaultModel = options.defaultModel ?? 'indotts-v1';
    }

    async isAvailable(): Promise<boolean> {
        // IndoTTS can be self-hosted without API key — check baseUrl reachability
        // For simplicity, available if baseUrl is set (not empty)
        return this.baseUrl.length > 0;
    }

    async synthesize(
        request: VoiceSynthesisRequest,
    ): Promise<VoiceSynthesisResult> {
        try {
            const model = (request.settings?.['model'] as string) ?? this.defaultModel;
            const speed = (request.settings?.['speed'] as number) ?? 1.0;
            const pitch = (request.settings?.['pitch'] as number) ?? 1.0;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Accept: 'audio/wav',
            };

            // API key optional for self-hosted
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(`${this.baseUrl}/tts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text: request.text,
                    voice_id: request.voiceId,
                    model,
                    speed,
                    pitch,
                    language: 'id',
                }),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!response.ok) {
                const errorText = await response
                    .text()
                    .catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `IndoTTS API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            // IndoTTS returns audio binary — convert to base64 data URL
            const audioBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(audioBuffer).toString('base64');
            const audioDataUrl = `data:audio/wav;base64,${base64}`;

            // Estimate duration
            const wordCount = request.text.split(/\s+/).length;
            const estimatedDuration = Math.max(1, wordCount / 2.5);

            return {
                url: audioDataUrl,
                providerName: this.name,
                durationActual: estimatedDuration,
                cost: this.defaultCostUsd,
                raw: {
                    model,
                    voiceId: request.voiceId,
                    characters: request.text.length,
                },
            };
        } catch (err) {
            if (err instanceof MediaProviderError) {
                throw err;
            }
            const message =
                err instanceof Error ? err.message : String(err);
            const isTimeout =
                err instanceof Error && err.name === 'TimeoutError';
            throw new MediaProviderError(
                isTimeout
                    ? `IndoTTS request timed out after ${this.timeoutMs}ms`
                    : `IndoTTS request failed: ${message}`,
                this.name,
                err,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Registry Factory
// ---------------------------------------------------------------------------

/**
 * Buat MediaProviderRegistry dengan ketiga voice provider sudah terdaftar
 * dan chain sudah di-set. Default chain: ElevenLabs → Cartesia → IndoTTS.
 *
 * Sesuai REDESIGN-VIDEO-FACTORY.md §4: "ElevenLabs/Cartesia (primary, wajib uji
 * kualitas Bahasa Indonesia untuk rentang suara yang dibutuhkan tiap universe)
 * + IndoTTS (fallback)"
 *
 * Caller (API route di apps/web atau video-worker) bertanggung jawab inject
 * API key dari environment variable. Kalau key kosong, provider tetap
 * terdaftar tapi `isAvailable()` return false — fallback chain akan skip
 * ke provider berikutnya.
 */
export function createVoiceProviderRegistry(options: {
    elevenlabs?: VoiceProviderOptions;
    cartesia?: VoiceProviderOptions;
    indoTts?: VoiceProviderOptions;
    /** Override urutan fallback chain. Default: ['elevenlabs', 'cartesia', 'indo-tts'] */
    chain?: string[];
} = {}): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();

    const elevenlabs = new ElevenLabsProvider(options.elevenlabs);
    const cartesia = new CartesiaProvider(options.cartesia);
    const indoTts = new IndoTTSProvider(options.indoTts);

    registry.registerVoiceProvider(elevenlabs);
    registry.registerVoiceProvider(cartesia);
    registry.registerVoiceProvider(indoTts);

    // Default chain: ElevenLabs → Cartesia → IndoTTS
    registry.setVoiceChain(
        options.chain ?? [elevenlabs.name, cartesia.name, indoTts.name],
    );

    return registry;
}