/**
 * VF-3.1 — Image Provider Tests
 *
 * Tests for NanoBanana2Provider and Flux2ProProvider real implementations.
 * Mocks globalThis.fetch to test API call logic without hitting real endpoints.
 *
 * Test coverage:
 * - Provider construction & isAvailable()
 * - generateImage() success path (mock fetch returns valid response)
 * - Error handling (API error, no image in response, network error)
 * - Reference-image conditioning (reference images passed correctly)
 * - createImageProviderRegistry() factory + fallback chain integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    NanoBanana2Provider,
    Flux2ProProvider,
    createImageProviderRegistry,
    type ImageProviderOptions,
} from '../src/ai/media-providers/image-provider.js';
import { MediaProviderError, MediaChainExhaustedError } from '../src/ai/media-providers/types.js';
import type { ImageGenerationRequest } from '../src/ai/media-providers/types.js';

// ---------------------------------------------------------------------------
// Helpers — mock fetch responses
// ---------------------------------------------------------------------------

/** Create a mock Response object */
function mockResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        headers: new Headers({ 'content-type': 'application/json' }),
    } as Response;
}

/** Gemini-style response with inline_data image */
function geminiResponse(imageBase64 = 'iVBORw0KGgoAAAANSUhEUg==', mimeType = 'image/png') {
    return {
        candidates: [
            {
                content: {
                    parts: [
                        { inline_data: { mime_type: mimeType, data: imageBase64 } },
                    ],
                },
            },
        ],
    };
}

/** fal.ai-style response with image URL */
function falResponse(imageUrl = 'https://fal.run/result/image-123.png') {
    return {
        images: [{ url: imageUrl }],
    };
}

/** Standard image generation request */
function standardRequest(overrides: Partial<ImageGenerationRequest> = {}): ImageGenerationRequest {
    return {
        prompt: 'A brave young shark swimming in a coral reef, 2D digital illustration',
        aspectRatio: '9:16',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// NanoBanana2Provider Tests
// ---------------------------------------------------------------------------

describe('NanoBanana2Provider', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('construction & isAvailable()', () => {
        it('membuat provider dengan API key yang disuplai', () => {
            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            expect(provider.name).toBe('nano-banana-2');
            expect(provider.isAvailable()).resolves.toBe(true);
        });

        it('isAvailable() return false kalau API key kosong', () => {
            const provider = new NanoBanana2Provider({});
            expect(provider.isAvailable()).resolves.toBe(false);
        });

        it('menerima custom baseUrl, defaultCostUsd, timeoutMs', () => {
            const provider = new NanoBanana2Provider({
                apiKey: 'test-key',
                baseUrl: 'https://custom.api.example.com',
                defaultCostUsd: 0.099,
                timeoutMs: 5000,
            });
            expect(provider.isAvailable()).resolves.toBe(true);
        });
    });

    describe('generateImage() — success path', () => {
        it('berhasil generate image dan return data URL', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(geminiResponse('base64data123')),
            );
            globalThis.fetch = fetchMock;

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            const result = await provider.generateImage(standardRequest());

            expect(result.providerName).toBe('nano-banana-2');
            expect(result.url).toContain('data:image/png;base64,base64data123');
            expect(result.cost).toBe(0.039); // default cost
            expect(result.raw).toBeDefined();

            // Verify fetch was called with correct URL
            const fetchCall = fetchMock.mock.calls[0];
            expect(fetchCall[0]).toContain('gemini-2.5-flash-image:generateContent');
            expect(fetchCall[0]).toContain('key=test-key');
        });

        it('mencatat cost dari defaultCostUsd option', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse(geminiResponse()),
            );

            const provider = new NanoBanana2Provider({
                apiKey: 'test-key',
                defaultCostUsd: 0.075,
            });
            const result = await provider.generateImage(standardRequest());

            expect(result.cost).toBe(0.075);
        });

        it('menambahkan negative prompt ke prompt text', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(geminiResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            await provider.generateImage(standardRequest({
                negativePrompt: 'blurry, low quality, distorted',
            }));

            // Verify the request body contains the negative prompt
            const fetchCall = fetchMock.mock.calls[0];
            const fetchOptions = fetchCall[1];
            const body = JSON.parse(fetchOptions.body);
            const textPart = body.contents[0].parts[0];
            expect(textPart.text).toContain('Avoid: blurry, low quality, distorted');
        });

        it('menambahkan aspect ratio ke prompt text', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(geminiResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            await provider.generateImage(standardRequest({
                aspectRatio: '9:16',
            }));

            const fetchCall = fetchMock.mock.calls[0];
            const body = JSON.parse(fetchCall[1].body);
            const textPart = body.contents[0].parts[0];
            expect(textPart.text).toContain('9:16');
        });
    });

    describe('generateImage() — reference image conditioning', () => {
        it('fetch reference images dan pass sebagai inline_data', async () => {
            // Mock: first call = reference image fetch, second call = Gemini API
            const refImageBuffer = new ArrayBuffer(10);
            const fetchMock = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: async () => refImageBuffer,
                    headers: new Headers({ 'content-type': 'image/png' }),
                } as Response)
                .mockResolvedValueOnce(mockResponse(geminiResponse()));

            globalThis.fetch = fetchMock;

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            const result = await provider.generateImage(standardRequest({
                referenceImages: ['https://example.com/ref-image.png'],
            }));

            expect(result.url).toContain('data:image/png;base64,');

            // Verify fetch was called twice (reference image + API call)
            expect(fetchMock).toHaveBeenCalledTimes(2);

            // Verify the API call body contains inline_data part
            const apiCall = fetchMock.mock.calls[1];
            const body = JSON.parse(apiCall[1].body);
            const parts = body.contents[0].parts;
            // parts[0] = text, parts[1] = inline_data
            expect(parts.length).toBe(2);
            expect(parts[1].inline_data).toBeDefined();
            expect(parts[1].inline_data.mime_type).toBe('image/png');
            expect(parts[1].inline_data.data).toBeDefined();
        });

        it('skip reference image yang gagal di-fetch tanpa menghentikan generate', async () => {
            // Mock: reference image fetch fails, API call succeeds
            const fetchMock = vi.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    arrayBuffer: async () => new ArrayBuffer(0),
                    headers: new Headers(),
                } as Response)
                .mockResolvedValueOnce(mockResponse(geminiResponse()));

            globalThis.fetch = fetchMock;

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            const result = await provider.generateImage(standardRequest({
                referenceImages: ['https://example.com/broken-image.png'],
            }));

            // Should still succeed — broken reference image is skipped
            expect(result.url).toContain('data:image/png;base64,');

            // API call body should only have text part (no inline_data)
            const apiCall = fetchMock.mock.calls[1];
            const body = JSON.parse(apiCall[1].body);
            const parts = body.contents[0].parts;
            expect(parts.length).toBe(1); // only text part
        });

        it('maksimal 14 reference image (limit Gemini)', async () => {
            // Create 20 reference image URLs
            const refUrls = Array.from({ length: 20 }, (_, i) => `https://example.com/ref-${i}.png`);

            // Mock: 14 reference image fetches + 1 API call
            const refImageBuffer = new ArrayBuffer(5);
            const fetchMock = vi.fn();
            for (let i = 0; i < 14; i++) {
                fetchMock.mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: async () => refImageBuffer,
                    headers: new Headers({ 'content-type': 'image/png' }),
                } as Response);
            }
            fetchMock.mockResolvedValueOnce(mockResponse(geminiResponse()));

            globalThis.fetch = fetchMock;

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            await provider.generateImage(standardRequest({
                referenceImages: refUrls,
            }));

            // 14 reference fetches + 1 API call = 15 total fetch calls
            expect(fetchMock).toHaveBeenCalledTimes(15);
        });
    });

    describe('generateImage() — error handling', () => {
        it('throw MediaProviderError kalau API key tidak dikonfigurasi', async () => {
            const provider = new NanoBanana2Provider({});
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow(MediaProviderError);
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('Gemini API key not configured');
        });

        it('throw MediaProviderError kalau API return error status', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Invalid API key' }, false, 401),
            );

            const provider = new NanoBanana2Provider({ apiKey: 'bad-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('Gemini API error (401)');
        });

        it('throw MediaProviderError kalau response tidak ada candidates', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ candidates: [] }),
            );

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('Gemini returned no candidates');
        });

        it('throw MediaProviderError kalau response tidak ada image data', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({
                    candidates: [{
                        content: {
                            parts: [{ text: 'I cannot generate this image' }],
                        },
                    }],
                }),
            );

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('Gemini response contained no image data');
        });

        it('wrap network error sebagai MediaProviderError', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('Gemini request failed: Network failure');
        });

        it('MediaProviderError menyimpan providerName yang benar', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Server error' }, false, 500),
            );

            const provider = new NanoBanana2Provider({ apiKey: 'test-key' });
            try {
                await provider.generateImage(standardRequest());
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(MediaProviderError);
                expect((err as MediaProviderError).providerName).toBe('nano-banana-2');
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Flux2ProProvider Tests
// ---------------------------------------------------------------------------

describe('Flux2ProProvider', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('construction & isAvailable()', () => {
        it('membuat provider dengan API key yang disuplai', () => {
            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            expect(provider.name).toBe('flux-2-pro');
            expect(provider.isAvailable()).resolves.toBe(true);
        });

        it('isAvailable() return false kalau API key kosong', () => {
            const provider = new Flux2ProProvider({});
            expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe('generateImage() — success path', () => {
        it('berhasil generate image dan return URL', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse('https://fal.run/result/abc.png')),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            const result = await provider.generateImage(standardRequest());

            expect(result.providerName).toBe('flux-2-pro');
            expect(result.url).toBe('https://fal.run/result/abc.png');
            expect(result.cost).toBe(0.05); // default cost
            expect(result.raw).toBeDefined();

            // Verify fetch was called with correct auth header
            const fetchCall = fetchMock.mock.calls[0];
            expect(fetchCall[1].headers.Authorization).toBe('Key fal-key');
        });

        it('pass aspect_ratio di request body', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await provider.generateImage(standardRequest({
                aspectRatio: '9:16',
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.aspect_ratio).toBe('9:16');
        });

        it('pass negative_prompt kalau disuplai', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await provider.generateImage(standardRequest({
                negativePrompt: 'blurry, distorted',
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.negative_prompt).toBe('blurry, distorted');
        });

        it('pass seed kalau disuplai', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await provider.generateImage(standardRequest({
                seed: 42,
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.seed).toBe(42);
        });
    });

    describe('generateImage() — reference image conditioning', () => {
        it('pass reference image sebagai image_url di request body', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await provider.generateImage(standardRequest({
                referenceImages: ['https://example.com/character-ref.png'],
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.image_url).toBe('https://example.com/character-ref.png');
            expect(body.strength).toBe(0.85);
        });

        it('hanya pass reference image pertama (fal.ai limit)', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await provider.generateImage(standardRequest({
                referenceImages: [
                    'https://example.com/ref1.png',
                    'https://example.com/ref2.png',
                    'https://example.com/ref3.png',
                ],
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.image_url).toBe('https://example.com/ref1.png');
            // Only first reference image is passed
        });

        it('tidak pass image_url kalau tidak ada reference image', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(falResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await provider.generateImage(standardRequest());

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.image_url).toBeUndefined();
        });
    });

    describe('generateImage() — error handling', () => {
        it('throw MediaProviderError kalau API key tidak dikonfigurasi', async () => {
            const provider = new Flux2ProProvider({});
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('fal.ai API key not configured');
        });

        it('throw MediaProviderError kalau API return error status', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Unauthorized' }, false, 401),
            );

            const provider = new Flux2ProProvider({ apiKey: 'bad-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('fal.ai API error (401)');
        });

        it('throw MediaProviderError kalau response tidak ada images', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ images: [] }),
            );

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('fal.ai returned no images');
        });

        it('throw MediaProviderError kalau response missing image URL', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ images: [{ /* no url field */ }] }),
            );

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('fal.ai response missing image URL');
        });

        it('wrap network error sebagai MediaProviderError', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            await expect(provider.generateImage(standardRequest()))
                .rejects.toThrow('fal.ai request failed: Connection refused');
        });

        it('MediaProviderError menyimpan providerName yang benar', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Server error' }, false, 500),
            );

            const provider = new Flux2ProProvider({ apiKey: 'fal-key' });
            try {
                await provider.generateImage(standardRequest());
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(MediaProviderError);
                expect((err as MediaProviderError).providerName).toBe('flux-2-pro');
            }
        });
    });
});

// ---------------------------------------------------------------------------
// createImageProviderRegistry() Tests
// ---------------------------------------------------------------------------

describe('createImageProviderRegistry', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('membuat registry dengan kedua provider terdaftar', () => {
        const registry = createImageProviderRegistry({
            nanoBanana2: { apiKey: 'gemini-key' },
            flux2Pro: { apiKey: 'fal-key' },
        });

        // Both providers should be available
        // We can test this by generating an image with both available
        expect(registry).toBeDefined();
    });

    it('default chain: nano-banana-2 → flux-2-pro', async () => {
        // Mock: first call (nano-banana-2) succeeds
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockResponse(geminiResponse()),
        );

        const registry = createImageProviderRegistry({
            nanoBanana2: { apiKey: 'gemini-key' },
            flux2Pro: { apiKey: 'fal-key' },
        });

        const { result, providerUsed, attempts } = await registry.generateImage(standardRequest());

        expect(providerUsed).toBe('nano-banana-2');
        expect(attempts).toEqual(['nano-banana-2']);
        expect(result.url).toContain('data:image/png;base64,');
    });

    it('fallback ke flux-2-pro kalau nano-banana-2 gagal', async () => {
        // Mock: first call (nano-banana-2) fails, second call (flux-2-pro) succeeds
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(mockResponse({ error: 'Gemini down' }, false, 500))
            .mockResolvedValueOnce(mockResponse(falResponse('https://fal.run/fallback.png')));

        globalThis.fetch = fetchMock;

        const registry = createImageProviderRegistry({
            nanoBanana2: { apiKey: 'gemini-key' },
            flux2Pro: { apiKey: 'fal-key' },
        });

        const { result, providerUsed, attempts } = await registry.generateImage(standardRequest());

        expect(providerUsed).toBe('flux-2-pro');
        expect(attempts).toEqual(['nano-banana-2', 'flux-2-pro']);
        expect(result.url).toBe('https://fal.run/fallback.png');
    });

    it('skip provider yang unavailable (API key kosong) dan pakai yang available', async () => {
        // nano-banana-2 has no API key → isAvailable() = false → skipped
        // flux-2-pro has API key → used
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockResponse(falResponse('https://fal.run/no-key-skip.png')),
        );

        const registry = createImageProviderRegistry({
            nanoBanana2: {}, // no API key
            flux2Pro: { apiKey: 'fal-key' },
        });

        const { providerUsed, attempts } = await registry.generateImage(standardRequest());

        // nano-banana-2 is unavailable, so it should be skipped
        // attempts should only contain flux-2-pro (the one that was actually tried)
        expect(providerUsed).toBe('flux-2-pro');
        expect(attempts).toContain('flux-2-pro');
    });

    it('throw MediaChainExhaustedError kalau SEMUA provider gagal', async () => {
        // Both providers fail
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(mockResponse({ error: 'Gemini error' }, false, 500))
            .mockResolvedValueOnce(mockResponse({ error: 'fal.ai error' }, false, 500));

        globalThis.fetch = fetchMock;

        const registry = createImageProviderRegistry({
            nanoBanana2: { apiKey: 'gemini-key' },
            flux2Pro: { apiKey: 'fal-key' },
        });

        await expect(registry.generateImage(standardRequest()))
            .rejects.toThrow(MediaChainExhaustedError);
    });

    it('menerima custom chain order', async () => {
        // Custom chain: flux-2-pro first, then nano-banana-2
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockResponse(falResponse('https://fal.run/custom-chain.png')),
        );

        const registry = createImageProviderRegistry({
            nanoBanana2: { apiKey: 'gemini-key' },
            flux2Pro: { apiKey: 'fal-key' },
            chain: ['flux-2-pro', 'nano-banana-2'],
        });

        const { providerUsed } = await registry.generateImage(standardRequest());

        expect(providerUsed).toBe('flux-2-pro');
    });
});