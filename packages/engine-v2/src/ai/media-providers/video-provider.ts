/**
 * Suro-Buya Engine v2 - Video Provider Implementations (VF-3.3)
 *
 * Real implementations of VideoProvider for image-to-video generation:
 * - Kling 3.0 (primary) — unggul short-form vertical, via fal.ai
 * - Seedance 2 (fallback 1) — via fal.ai
 * - Wan 2.7 (fallback 2) — via fal.ai (opsional self-host di VF-6 untuk cost optimization)
 *
 * Fallback chain: Kling 3.0 → Seedance 2 → Wan 2.7
 * (REDESIGN-VIDEO-FACTORY.md §4: "Kling 3.0 (primary) → Seedance 2 → Wan 2.7 (fallback chain)")
 *
 * Semua provider menerima keyframeUrl (dari ImageProvider VF-3.1/3.2) dan
 * menganimasikannya menjadi video clip. Motion prompt opsional mengarahkan
 * gerak kamera/karakter — kalau kosong, provider pakai default/preset.
 *
 * Pola: sama dengan image-provider.ts (VF-3.1) — API key via constructor,
 * engine-v2 tidak baca env langsung.
 */

import type {
    VideoProvider,
    VideoGenerationRequest,
    VideoGenerationResult,
} from './types.js';
import { MediaProviderError } from './types.js';
import { MediaProviderRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Common Options
// ---------------------------------------------------------------------------

/**
 * Konfigurasi untuk video provider nyata. Sama seperti ImageProviderOptions
 * (VF-3.1) — apiKey wajib diisi oleh caller dari environment variable.
 */
export interface VideoProviderOptions {
    /** API key untuk provider (wajib untuk operasi nyata). */
    apiKey?: string;
    /** Base URL API, bisa di-override untuk testing/proxy/self-host. */
    baseUrl?: string;
    /** Biaya default per video clip dalam USD. */
    defaultCostUsd?: number;
    /** Timeout request dalam ms. Default: 300000 (5 menit — video gen jauh lebih lambat dari image). */
    timeoutMs?: number;
    /** Interval polling untuk provider async (ms). Default: 5000. */
    pollIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Kling 3.0 (via fal.ai)
// ---------------------------------------------------------------------------

/**
 * Kling 3.0 — model image-to-video dari Kuaishou, diakses via fal.ai.
 *
 * Provider video generation primary. Unggul untuk short-form vertical video
 * (REDESIGN-VIDEO-FACTORY.md §4). Menerima keyframe image URL dan
 * menganimasikannya menjadi video clip sesuai motion prompt.
 *
 * API: fal.ai
 * Endpoint: https://fal.run/kwaivgi/kling-v2-master
 * Auth: API key via Authorization header
 *
 * Kling API bersifat async — submit request, lalu poll status sampai selesai.
 */
export class Kling3Provider implements VideoProvider {
    readonly name = 'kling-3.0';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;
    private readonly pollIntervalMs: number;

    constructor(options: VideoProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl =
            options.baseUrl ?? 'https://fal.run/kwaivgi/kling-v2-master';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.35;
        this.timeoutMs = options.timeoutMs ?? 300000;
        this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async generateClip(
        request: VideoGenerationRequest,
    ): Promise<VideoGenerationResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'fal.ai API key not configured for Kling 3.0 — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            // Submit generation request
            const body: Record<string, unknown> = {
                image_url: request.keyframeUrl,
                duration: String(request.duration),
                aspect_ratio: request.aspectRatio ?? '9:16',
            };

            if (request.motionPrompt) {
                body['prompt'] = request.motionPrompt;
            }

            const submitResponse = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Key ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!submitResponse.ok) {
                const errorText = await submitResponse
                    .text()
                    .catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `Kling 3.0 submit error (${submitResponse.status}): ${errorText}`,
                    this.name,
                    { status: submitResponse.status, body: errorText },
                );
            }

            const submitData = (await submitResponse.json()) as Record<string, any>;
            const requestId = submitData['request_id'];

            if (!requestId) {
                // Some fal.ai endpoints return result directly (sync mode)
                const videoUrl = submitData['video']?.['url'] ?? submitData['url'];
                if (videoUrl) {
                    return {
                        url: videoUrl,
                        providerName: this.name,
                        durationActual: request.duration,
                        cost: this.defaultCostUsd,
                        raw: submitData,
                    };
                }
                throw new MediaProviderError(
                    'Kling 3.0 response missing request_id and video URL',
                    this.name,
                    submitData,
                );
            }

            // Poll for completion (async mode)
            const result = await this.pollStatus(requestId, request.duration);

            return {
                url: result.url,
                providerName: this.name,
                durationActual: result.durationActual,
                cost: this.defaultCostUsd,
                raw: result.raw,
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
                    ? `Kling 3.0 request timed out after ${this.timeoutMs}ms`
                    : `Kling 3.0 request failed: ${message}`,
                this.name,
                err,
            );
        }
    }

    /**
     * Poll fal.ai status endpoint sampai video selesai atau timeout.
     */
    private async pollStatus(
        requestId: string,
        expectedDuration: number,
    ): Promise<{ url: string; durationActual: number; raw: unknown }> {
        const statusUrl = `https://fal.run/fal-ai/fal/requests/${requestId}/status`;
        const startTime = Date.now();

        while (Date.now() - startTime < this.timeoutMs) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.pollIntervalMs),
            );

            const statusResponse = await fetch(statusUrl, {
                headers: { Authorization: `Key ${this.apiKey}` },
                signal: AbortSignal.timeout(30000),
            });

            if (!statusResponse.ok) {
                continue; // Retry on transient status check failure
            }

            const statusData = (await statusResponse.json()) as Record<string, any>;
            const status = statusData['status'];

            if (status === 'COMPLETED') {
                const videoUrl = statusData['video']?.['url'] ?? statusData['url'];
                if (!videoUrl) {
                    throw new MediaProviderError(
                        'Kling 3.0 completed but no video URL in response',
                        this.name,
                        statusData,
                    );
                }
                return {
                    url: videoUrl,
                    durationActual: expectedDuration,
                    raw: statusData,
                };
            }

            if (status === 'FAILED') {
                throw new MediaProviderError(
                    `Kling 3.0 generation failed: ${statusData['error'] ?? 'Unknown error'}`,
                    this.name,
                    statusData,
                );
            }
            // status === 'IN_PROGRESS' or 'IN_QUEUE' → keep polling
        }

        throw new MediaProviderError(
            `Kling 3.0 polling timed out after ${this.timeoutMs}ms`,
            this.name,
        );
    }
}

// ---------------------------------------------------------------------------
// Seedance 2 (via fal.ai)
// ---------------------------------------------------------------------------

/**
 * Seedance 2 — model image-to-video dari ByteDance, diakses via fal.ai.
 *
 * Provider fallback pertama. Dipakai kalau Kling 3.0 gagal atau unavailable.
 *
 * API: fal.ai
 * Endpoint: https://fal.run/bytedance/seedance-v2
 * Auth: API key via Authorization header
 */
export class Seedance2Provider implements VideoProvider {
    readonly name = 'seedance-2';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;
    private readonly pollIntervalMs: number;

    constructor(options: VideoProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl =
            options.baseUrl ?? 'https://fal.run/bytedance/seedance-v2';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.30;
        this.timeoutMs = options.timeoutMs ?? 300000;
        this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async generateClip(
        request: VideoGenerationRequest,
    ): Promise<VideoGenerationResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'fal.ai API key not configured for Seedance 2 — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            const body: Record<string, unknown> = {
                image_url: request.keyframeUrl,
                duration: String(request.duration),
                aspect_ratio: request.aspectRatio ?? '9:16',
            };

            if (request.motionPrompt) {
                body['prompt'] = request.motionPrompt;
            }

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Key ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!response.ok) {
                const errorText = await response
                    .text()
                    .catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `Seedance 2 API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            const data = (await response.json()) as Record<string, any>;

            // Check for direct result (sync mode)
            const videoUrl = data['video']?.['url'] ?? data['url'];
            if (videoUrl) {
                return {
                    url: videoUrl,
                    providerName: this.name,
                    durationActual: request.duration,
                    cost: this.defaultCostUsd,
                    raw: data,
                };
            }

            // Check for async request_id
            const requestId = data['request_id'];
            if (requestId) {
                const result = await this.pollStatus(requestId, request.duration);
                return {
                    url: result.url,
                    providerName: this.name,
                    durationActual: result.durationActual,
                    cost: this.defaultCostUsd,
                    raw: result.raw,
                };
            }

            throw new MediaProviderError(
                'Seedance 2 response missing video URL and request_id',
                this.name,
                data,
            );
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
                    ? `Seedance 2 request timed out after ${this.timeoutMs}ms`
                    : `Seedance 2 request failed: ${message}`,
                this.name,
                err,
            );
        }
    }

    private async pollStatus(
        requestId: string,
        expectedDuration: number,
    ): Promise<{ url: string; durationActual: number; raw: unknown }> {
        const statusUrl = `https://fal.run/fal-ai/fal/requests/${requestId}/status`;
        const startTime = Date.now();

        while (Date.now() - startTime < this.timeoutMs) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.pollIntervalMs),
            );

            const statusResponse = await fetch(statusUrl, {
                headers: { Authorization: `Key ${this.apiKey}` },
                signal: AbortSignal.timeout(30000),
            });

            if (!statusResponse.ok) continue;

            const statusData = (await statusResponse.json()) as Record<string, any>;
            const status = statusData['status'];

            if (status === 'COMPLETED') {
                const videoUrl = statusData['video']?.['url'] ?? statusData['url'];
                if (!videoUrl) {
                    throw new MediaProviderError(
                        'Seedance 2 completed but no video URL in response',
                        this.name,
                        statusData,
                    );
                }
                return {
                    url: videoUrl,
                    durationActual: expectedDuration,
                    raw: statusData,
                };
            }

            if (status === 'FAILED') {
                throw new MediaProviderError(
                    `Seedance 2 generation failed: ${statusData['error'] ?? 'Unknown error'}`,
                    this.name,
                    statusData,
                );
            }
        }

        throw new MediaProviderError(
            `Seedance 2 polling timed out after ${this.timeoutMs}ms`,
            this.name,
        );
    }
}

// ---------------------------------------------------------------------------
// Wan 2.7 (via fal.ai / self-host)
// ---------------------------------------------------------------------------

/**
 * Wan 2.7 — model image-to-video dari Alibaba, diakses via fal.ai atau self-host.
 *
 * Provider fallback terakhir. Dipakai kalau Kling 3.0 dan Seedance 2 keduanya gagal.
 * Di VF-6, Wan 2.7 bisa di-self-host untuk cost optimization
 * (REDESIGN-VIDEO-FACTORY.md §10: "Wan 2.7 self-host & IndoTTS sebagai cost lever VF-6").
 *
 * API: fal.ai (default) atau self-hosted endpoint
 * Endpoint: https://fal.run/wan/wan-2.7
 * Auth: API key via Authorization header
 */
export class Wan2_7Provider implements VideoProvider {
    readonly name = 'wan-2.7';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;
    private readonly pollIntervalMs: number;

    constructor(options: VideoProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl =
            options.baseUrl ?? 'https://fal.run/wan/wan-2.7';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.25;
        this.timeoutMs = options.timeoutMs ?? 300000;
        this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async generateClip(
        request: VideoGenerationRequest,
    ): Promise<VideoGenerationResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'API key not configured for Wan 2.7 — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            const body: Record<string, unknown> = {
                image_url: request.keyframeUrl,
                duration: String(request.duration),
                aspect_ratio: request.aspectRatio ?? '9:16',
            };

            if (request.motionPrompt) {
                body['prompt'] = request.motionPrompt;
            }

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Key ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!response.ok) {
                const errorText = await response
                    .text()
                    .catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `Wan 2.7 API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            const data = (await response.json()) as Record<string, any>;

            // Check for direct result (sync mode)
            const videoUrl = data['video']?.['url'] ?? data['url'];
            if (videoUrl) {
                return {
                    url: videoUrl,
                    providerName: this.name,
                    durationActual: request.duration,
                    cost: this.defaultCostUsd,
                    raw: data,
                };
            }

            // Check for async request_id
            const requestId = data['request_id'];
            if (requestId) {
                const result = await this.pollStatus(requestId, request.duration);
                return {
                    url: result.url,
                    providerName: this.name,
                    durationActual: result.durationActual,
                    cost: this.defaultCostUsd,
                    raw: result.raw,
                };
            }

            throw new MediaProviderError(
                'Wan 2.7 response missing video URL and request_id',
                this.name,
                data,
            );
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
                    ? `Wan 2.7 request timed out after ${this.timeoutMs}ms`
                    : `Wan 2.7 request failed: ${message}`,
                this.name,
                err,
            );
        }
    }

    private async pollStatus(
        requestId: string,
        expectedDuration: number,
    ): Promise<{ url: string; durationActual: number; raw: unknown }> {
        const statusUrl = `https://fal.run/fal-ai/fal/requests/${requestId}/status`;
        const startTime = Date.now();

        while (Date.now() - startTime < this.timeoutMs) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.pollIntervalMs),
            );

            const statusResponse = await fetch(statusUrl, {
                headers: { Authorization: `Key ${this.apiKey}` },
                signal: AbortSignal.timeout(30000),
            });

            if (!statusResponse.ok) continue;

            const statusData = (await statusResponse.json()) as Record<string, any>;
            const status = statusData['status'];

            if (status === 'COMPLETED') {
                const videoUrl = statusData['video']?.['url'] ?? statusData['url'];
                if (!videoUrl) {
                    throw new MediaProviderError(
                        'Wan 2.7 completed but no video URL in response',
                        this.name,
                        statusData,
                    );
                }
                return {
                    url: videoUrl,
                    durationActual: expectedDuration,
                    raw: statusData,
                };
            }

            if (status === 'FAILED') {
                throw new MediaProviderError(
                    `Wan 2.7 generation failed: ${statusData['error'] ?? 'Unknown error'}`,
                    this.name,
                    statusData,
                );
            }
        }

        throw new MediaProviderError(
            `Wan 2.7 polling timed out after ${this.timeoutMs}ms`,
            this.name,
        );
    }
}

// ---------------------------------------------------------------------------
// Registry Factory
// ---------------------------------------------------------------------------

/**
 * Buat MediaProviderRegistry dengan ketiga video provider sudah terdaftar
 * dan chain sudah di-set. Default chain: Kling 3.0 → Seedance 2 → Wan 2.7.
 *
 * Sesuai REDESIGN-VIDEO-FACTORY.md §4: "Kling 3.0 (primary) → Seedance 2 → Wan 2.7 (fallback chain)"
 *
 * Caller (API route di apps/web) bertanggung jawab inject API key dari
 * environment variable. Kalau key kosong, provider tetap terdaftar tapi
 * `isAvailable()` return false — fallback chain akan skip ke provider berikutnya.
 */
export function createVideoProviderRegistry(options: {
    kling3?: VideoProviderOptions;
    seedance2?: VideoProviderOptions;
    wan2_7?: VideoProviderOptions;
    /** Override urutan fallback chain. Default: ['kling-3.0', 'seedance-2', 'wan-2.7'] */
    chain?: string[];
} = {}): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();

    const kling = new Kling3Provider(options.kling3);
    const seedance = new Seedance2Provider(options.seedance2);
    const wan = new Wan2_7Provider(options.wan2_7);

    registry.registerVideoProvider(kling);
    registry.registerVideoProvider(seedance);
    registry.registerVideoProvider(wan);

    // Default chain: Kling 3.0 → Seedance 2 → Wan 2.7
    registry.setVideoChain(options.chain ?? [kling.name, seedance.name, wan.name]);

    return registry;
}