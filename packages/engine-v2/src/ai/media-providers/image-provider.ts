/**
 * Suro-Buya Engine v2 - Image Provider Implementations (VF-3.1)
 *
 * Real implementations of ImageProvider for:
 * - Nano Banana 2 (Gemini 2.5 Flash Image) — primary, supports up to 14 reference images
 * - Flux 2 Pro (FLUX 1.1 Pro via fal.ai) — fallback, supports image-to-image conditioning
 *
 * Reference-image conditioning is the DEFAULT consistency mechanism
 * (REDESIGN-VIDEO-FACTORY.md §4: "Default konsistensi karakter tanpa training").
 * LoRA training is deferred to VF-6 (opsional).
 *
 * Pola: setiap provider adalah class terpisah yang implement ImageProvider interface
 * (VF-1.4). API key diterima via constructor — caller (API route di apps/web)
 * yang bertanggung jawab inject dari environment variable, engine-v2 TIDAK pernah
 * baca env langsung (konsisten dengan pola sejak VF-1.5: engine-v2 murni fungsi
 * transformasi, tidak akses DB/env).
 */

import type {
    ImageProvider,
    ImageGenerationRequest,
    ImageGenerationResult,
} from './types.js';
import { MediaProviderError } from './types.js';
import { MediaProviderRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Common Options & Helpers
// ---------------------------------------------------------------------------

/**
 * Konfigurasi untuk image provider nyata. `apiKey` wajib diisi oleh caller
 * (API route di apps/web) dari environment variable — engine-v2 tidak baca
 * env langsung (pola sejak VF-1.5).
 */
export interface ImageProviderOptions {
    /** API key untuk provider (wajib untuk operasi nyata). */
    apiKey?: string;
    /** Base URL API, bisa di-override untuk testing/proxy. */
    baseUrl?: string;
    /** Biaya default per image dalam USD, dipakai kalau provider tidak mengembalikan info cost. */
    defaultCostUsd?: number;
    /** Timeout request dalam ms. Default: 120000 (2 menit — image gen lebih lambat dari teks). */
    timeoutMs?: number;
}

/**
 * Fetch sebuah image dari URL dan konversi ke base64.
 * Dipakai NanoBanana2Provider untuk reference-image conditioning (Gemini API
 * butuh inline_data base64, bukan URL langsung).
 *
 * @returns null kalau fetch gagal — caller skip reference image yang gagal,
 *          tidak menghentikan seluruh generate (robust terhadap 1 reference
 *          image yang broken/expired).
 */
async function fetchImageAsBase64(
    url: string,
    timeoutMs = 30000,
): Promise<{ mimeType: string; base64: string } | null> {
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') ?? 'image/png';
        return { mimeType, base64 };
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Nano Banana 2 (Gemini 2.5 Flash Image)
// ---------------------------------------------------------------------------

/**
 * Nano Banana 2 — nickname untuk Google Gemini 2.5 Flash Image.
 *
 * Provider image generation dari Google yang mendukung reference-image
 * conditioning hingga 14 gambar (REDESIGN-VIDEO-FACTORY.md §4).
 * Reference image dipassing sebagai inline_data base64 di request body.
 *
 * API: Google Generative AI
 * Endpoint: /v1beta/models/gemini-2.5-flash-image:generateContent
 * Auth: API key via query parameter
 */
export class NanoBanana2Provider implements ImageProvider {
    readonly name = 'nano-banana-2';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;

    constructor(options: ImageProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl =
            options.baseUrl ??
            'https://generativelanguage.googleapis.com/v1beta';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.039;
        this.timeoutMs = options.timeoutMs ?? 120000;
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async generateImage(
        request: ImageGenerationRequest,
    ): Promise<ImageGenerationResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'Gemini API key not configured — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            // Build prompt text — tambah negative prompt dan aspect ratio sebagai
            // instruksi teks (Gemini tidak punya parameter terpisah untuk ini)
            let promptText = request.prompt;
            if (request.negativePrompt) {
                promptText += `\n\nAvoid: ${request.negativePrompt}`;
            }
            if (request.aspectRatio) {
                promptText += `\n\nAspect ratio: ${request.aspectRatio} (vertical 9:16 format for short-form video).`;
            }

            // Build parts: text prompt + reference images (inline_data base64)
            const parts: Array<Record<string, unknown>> = [{ text: promptText }];

            // Reference-image conditioning — fetch tiap URL, konversi ke base64,
            // tambahkan sebagai inline_data part. Maks 14 reference image (limit Gemini).
            if (request.referenceImages && request.referenceImages.length > 0) {
                const maxRefs = Math.min(request.referenceImages.length, 14);
                for (const refUrl of request.referenceImages.slice(0, maxRefs)) {
                    const img = await fetchImageAsBase64(refUrl);
                    if (img) {
                        parts.push({
                            inline_data: {
                                mime_type: img.mimeType,
                                data: img.base64,
                            },
                        });
                    }
                    // Kalau fetch gagal, skip reference image ini — jangan throw,
                    // lanjut ke reference image berikutnya (robust terhadap URL expired/broken)
                }
            }

            const body = {
                contents: [{ parts }],
                generationConfig: {
                    responseModalities: ['IMAGE', 'TEXT'],
                },
            };

            const apiUrl = `${this.baseUrl}/models/gemini-2.5-flash-image:generateContent?key=${this.apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new MediaProviderError(
                    `Gemini API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            const data = (await response.json()) as Record<string, any>;
            const candidates = data['candidates'] ?? [];
            if (candidates.length === 0) {
                throw new MediaProviderError(
                    'Gemini returned no candidates',
                    this.name,
                    data,
                );
            }

            const responseParts = candidates[0]?.content?.parts ?? [];
            const imagePart = responseParts.find(
                (p: any) => p.inline_data,
            );
            if (!imagePart) {
                throw new MediaProviderError(
                    'Gemini response contained no image data',
                    this.name,
                    data,
                );
            }

            const imageData = imagePart.inline_data.data;
            const mimeType = imagePart.inline_data.mime_type ?? 'image/png';
            // Return sebagai data URL — caller (API route) bisa upload ke S3
            // dan dapat URL persistent kalau perlu
            const resultUrl = `data:${mimeType};base64,${imageData}`;

            return {
                url: resultUrl,
                providerName: this.name,
                cost: this.defaultCostUsd,
                raw: data,
            };
        } catch (err) {
            // Re-throw MediaProviderError apa adanya
            if (err instanceof MediaProviderError) {
                throw err;
            }
            // Wrap error lainnya (network, timeout, parse) sebagai MediaProviderError
            const message =
                err instanceof Error ? err.message : String(err);
            const isTimeout =
                err instanceof Error && err.name === 'TimeoutError';
            throw new MediaProviderError(
                isTimeout
                    ? `Gemini request timed out after ${this.timeoutMs}ms`
                    : `Gemini request failed: ${message}`,
                this.name,
                err,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Flux 2 Pro (FLUX 1.1 Pro via fal.ai)
// ---------------------------------------------------------------------------

/**
 * Flux 2 Pro — FLUX 1.1 Pro dari Black Forest Labs, diakses via fal.ai.
 *
 * Provider image generation fallback yang mendukung image-to-image
 * conditioning (reference image). Berbeda dari Nano Banana 2 yang menerima
 * hingga 14 reference image, Flux 2 Pro via fal.ai menerima 1 reference
 * image utama sebagai `image_url` (fal.ai fetch server-side).
 *
 * API: fal.ai
 * Endpoint: https://fal.run/blackforest-labs/flux-1.1-pro
 * Auth: API key via Authorization header
 */
export class Flux2ProProvider implements ImageProvider {
    readonly name = 'flux-2-pro';

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultCostUsd: number;
    private readonly timeoutMs: number;

    constructor(options: ImageProviderOptions = {}) {
        this.apiKey = options.apiKey ?? '';
        this.baseUrl =
            options.baseUrl ?? 'https://fal.run/blackforest-labs/flux-1.1-pro';
        this.defaultCostUsd = options.defaultCostUsd ?? 0.05;
        this.timeoutMs = options.timeoutMs ?? 120000;
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async generateImage(
        request: ImageGenerationRequest,
    ): Promise<ImageGenerationResult> {
        if (!this.apiKey) {
            throw new MediaProviderError(
                'fal.ai API key not configured — pass apiKey via constructor',
                this.name,
            );
        }

        try {
            // Build request body — fal.ai FLUX 1.1 Pro API format
            const body: Record<string, unknown> = {
                prompt: request.prompt,
                aspect_ratio: request.aspectRatio ?? '9:16',
            };

            if (request.negativePrompt) {
                body['negative_prompt'] = request.negativePrompt;
            }

            if (request.seed !== undefined) {
                body['seed'] = request.seed;
            }

            // Reference-image conditioning — pass first reference image as image_url.
            // fal.ai fetches the URL server-side (tidak perlu base64 inline).
            // FLUX 1.1 Pro via fal.ai menerima 1 reference image utama untuk
            // image-to-image conditioning.
            if (request.referenceImages && request.referenceImages.length > 0) {
                body['image_url'] = request.referenceImages[0];
                body['strength'] = 0.85; // Reference conditioning strength (0-1)
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
                    `fal.ai API error (${response.status}): ${errorText}`,
                    this.name,
                    { status: response.status, body: errorText },
                );
            }

            const data = (await response.json()) as Record<string, any>;
            const images = data['images'] ?? [];
            if (images.length === 0) {
                throw new MediaProviderError(
                    'fal.ai returned no images',
                    this.name,
                    data,
                );
            }

            const imageUrl = images[0]?.url;
            if (!imageUrl) {
                throw new MediaProviderError(
                    'fal.ai response missing image URL',
                    this.name,
                    data,
                );
            }

            return {
                url: imageUrl,
                providerName: this.name,
                cost: this.defaultCostUsd,
                raw: data,
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
                    ? `fal.ai request timed out after ${this.timeoutMs}ms`
                    : `fal.ai request failed: ${message}`,
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
 * Buat MediaProviderRegistry dengan kedua image provider sudah terdaftar
 * dan chain sudah di-set. Default chain: Nano Banana 2 (primary) → Flux 2 Pro (fallback).
 *
 * Caller (API route di apps/web) bertanggung jawab inject API key dari
 * environment variable. Kalau key kosong, provider tetap terdaftar tapi
 * `isAvailable()` return false — fallback chain akan skip ke provider berikutnya.
 */
export function createImageProviderRegistry(options: {
    nanoBanana2?: ImageProviderOptions;
    flux2Pro?: ImageProviderOptions;
    /** Override urutan fallback chain. Default: ['nano-banana-2', 'flux-2-pro'] */
    chain?: string[];
} = {}): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();

    const nano = new NanoBanana2Provider(options.nanoBanana2);
    const flux = new Flux2ProProvider(options.flux2Pro);

    registry.registerImageProvider(nano);
    registry.registerImageProvider(flux);

    // Default chain: Nano Banana 2 (primary) → Flux 2 Pro (fallback)
    // Sesuai REDESIGN-VIDEO-FACTORY.md §4: "Flux 2 Pro / Nano Banana 2"
    registry.setImageChain(options.chain ?? [nano.name, flux.name]);

    return registry;
}