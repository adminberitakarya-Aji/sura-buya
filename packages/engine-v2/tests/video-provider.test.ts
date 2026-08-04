/**
 * VF-3.3 — Video Provider Tests
 *
 * Tests for Kling3Provider, Seedance2Provider, Wan2_7Provider real implementations.
 * Mocks globalThis.fetch to test API call logic without hitting real endpoints.
 *
 * Test coverage:
 * - Provider construction & isAvailable()
 * - generateClip() sync mode (mock fetch returns video URL directly)
 * - generateClip() async mode (submit → poll → completed)
 * - Error handling (API error, no video in response, network error, generation failed)
 * - createVideoProviderRegistry() factory + 3-tier fallback chain integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    Kling3Provider,
    Seedance2Provider,
    Wan2_7Provider,
    createVideoProviderRegistry,
    type VideoProviderOptions,
} from '../src/ai/media-providers/video-provider.js';
import { MediaProviderError, MediaChainExhaustedError } from '../src/ai/media-providers/types.js';
import type { VideoGenerationRequest } from '../src/ai/media-providers/types.js';

// ---------------------------------------------------------------------------
// Helpers — mock fetch responses
// ---------------------------------------------------------------------------

function mockResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        headers: new Headers({ 'content-type': 'application/json' }),
    } as Response;
}

/** Sync response — fal.ai returns video URL directly */
function syncVideoResponse(url = 'https://fal.run/video/result.mp4') {
    return {
        video: { url },
    };
}

/** Async submit response — returns request_id for polling */
function asyncSubmitResponse(requestId = 'req-123') {
    return {
        request_id: requestId,
    };
}

/** Async status response — IN_PROGRESS / COMPLETED / FAILED */
function statusResponse(status: string, videoUrl?: string) {
    if (status === 'COMPLETED' && videoUrl) {
        return { status, video: { url: videoUrl } };
    }
    return { status };
}

/** Standard video generation request */
function standardRequest(overrides: Partial<VideoGenerationRequest> = {}): VideoGenerationRequest {
    return {
        keyframeUrl: 'https://example.com/keyframe-001.png',
        duration: 5,
        aspectRatio: '9:16',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Kling3Provider Tests
// ---------------------------------------------------------------------------

describe('Kling3Provider', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('construction & isAvailable()', () => {
        it('membuat provider dengan API key', () => {
            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            expect(provider.name).toBe('kling-3.0');
            expect(provider.isAvailable()).resolves.toBe(true);
        });

        it('isAvailable() return false kalau API key kosong', () => {
            const provider = new Kling3Provider({});
            expect(provider.isAvailable()).resolves.toBe(false);
        });

        it('menerima custom baseUrl, defaultCostUsd, timeoutMs, pollIntervalMs', () => {
            const provider = new Kling3Provider({
                apiKey: 'fal-key',
                baseUrl: 'https://custom.api.example.com',
                defaultCostUsd: 0.50,
                timeoutMs: 60000,
                pollIntervalMs: 1000,
            });
            expect(provider.isAvailable()).resolves.toBe(true);
        });
    });

    describe('generateClip() — sync mode (direct result)', () => {
        it('berhasil generate video dan return URL (sync mode)', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse(syncVideoResponse('https://fal.run/kling-result.mp4')),
            );

            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            const result = await provider.generateClip(standardRequest());

            expect(result.providerName).toBe('kling-3.0');
            expect(result.url).toBe('https://fal.run/kling-result.mp4');
            expect(result.durationActual).toBe(5);
            expect(result.cost).toBe(0.35); // default cost
            expect(result.raw).toBeDefined();

            // Verify fetch was called with correct auth header
            const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
            const headers = fetchCall?.[1]?.headers as Record<string, string>;
            expect(headers?.Authorization).toBe('Key fal-key');
        });

        it('pass motion prompt di request body kalau disuplai', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(syncVideoResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            await provider.generateClip(standardRequest({
                motionPrompt: 'slow zoom in, character turns head',
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body['prompt']).toBe('slow zoom in, character turns head');
        });

        it('pass keyframeUrl, duration, aspect_ratio di request body', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                mockResponse(syncVideoResponse()),
            );
            globalThis.fetch = fetchMock;

            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            await provider.generateClip(standardRequest({
                keyframeUrl: 'https://example.com/keyframe.png',
                duration: 3,
                aspectRatio: '9:16',
            }));

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body['image_url']).toBe('https://example.com/keyframe.png');
            expect(body['duration']).toBe('3');
            expect(body['aspect_ratio']).toBe('9:16');
        });

        it('mencatat cost dari defaultCostUsd option', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse(syncVideoResponse()),
            );

            const provider = new Kling3Provider({
                apiKey: 'fal-key',
                defaultCostUsd: 0.45,
            });
            const result = await provider.generateClip(standardRequest());

            expect(result.cost).toBe(0.45);
        });
    });

    describe('generateClip() — async mode (submit + poll)', () => {
        it('berhasil generate video via async polling', async () => {
            // Mock: first call = submit (returns request_id),
            // second call = status IN_PROGRESS, third call = status COMPLETED
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(mockResponse(asyncSubmitResponse('req-abc')))
                .mockResolvedValueOnce(mockResponse(statusResponse('IN_PROGRESS')))
                .mockResolvedValueOnce(mockResponse(statusResponse('COMPLETED', 'https://fal.run/async-result.mp4')));

            globalThis.fetch = fetchMock;

            const provider = new Kling3Provider({
                apiKey: 'fal-key',
                pollIntervalMs: 10, // fast polling for test
            });
            const result = await provider.generateClip(standardRequest());

            expect(result.url).toBe('https://fal.run/async-result.mp4');
            expect(result.providerName).toBe('kling-3.0');
            expect(result.durationActual).toBe(5);

            // 3 fetch calls: submit + 2 status polls
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        it('throw MediaProviderError kalau generation FAILED saat polling', async () => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(mockResponse(asyncSubmitResponse('req-fail')))
                .mockResolvedValueOnce(mockResponse({
                    status: 'FAILED',
                    error: 'Content policy violation',
                }));

            globalThis.fetch = fetchMock;

            const provider = new Kling3Provider({
                apiKey: 'fal-key',
                pollIntervalMs: 10,
            });

            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Kling 3.0 generation failed: Content policy violation');
        });
    });

    describe('generateClip() — error handling', () => {
        it('throw MediaProviderError kalau API key tidak dikonfigurasi', async () => {
            const provider = new Kling3Provider({});
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('fal.ai API key not configured for Kling 3.0');
        });

        it('throw MediaProviderError kalau API return error status', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Unauthorized' }, false, 401),
            );

            const provider = new Kling3Provider({ apiKey: 'bad-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Kling 3.0 submit error (401)');
        });

        it('throw MediaProviderError kalau response tidak ada request_id dan video URL', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ /* empty response */ }),
            );

            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Kling 3.0 response missing request_id and video URL');
        });

        it('wrap network error sebagai MediaProviderError', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Kling 3.0 request failed: Network failure');
        });

        it('MediaProviderError menyimpan providerName yang benar', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Server error' }, false, 500),
            );

            const provider = new Kling3Provider({ apiKey: 'fal-key' });
            try {
                await provider.generateClip(standardRequest());
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(MediaProviderError);
                expect((err as MediaProviderError).providerName).toBe('kling-3.0');
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Seedance2Provider Tests
// ---------------------------------------------------------------------------

describe('Seedance2Provider', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('construction & isAvailable()', () => {
        it('membuat provider dengan API key', () => {
            const provider = new Seedance2Provider({ apiKey: 'fal-key' });
            expect(provider.name).toBe('seedance-2');
            expect(provider.isAvailable()).resolves.toBe(true);
        });

        it('isAvailable() return false kalau API key kosong', () => {
            const provider = new Seedance2Provider({});
            expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe('generateClip() — sync mode', () => {
        it('berhasil generate video dan return URL', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse(syncVideoResponse('https://fal.run/seedance-result.mp4')),
            );

            const provider = new Seedance2Provider({ apiKey: 'fal-key' });
            const result = await provider.generateClip(standardRequest());

            expect(result.providerName).toBe('seedance-2');
            expect(result.url).toBe('https://fal.run/seedance-result.mp4');
            expect(result.cost).toBe(0.30); // default cost
        });
    });

    describe('generateClip() — async mode', () => {
        it('berhasil generate video via async polling', async () => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(mockResponse(asyncSubmitResponse('req-seedance')))
                .mockResolvedValueOnce(mockResponse(statusResponse('COMPLETED', 'https://fal.run/seedance-async.mp4')));

            globalThis.fetch = fetchMock;

            const provider = new Seedance2Provider({
                apiKey: 'fal-key',
                pollIntervalMs: 10,
            });
            const result = await provider.generateClip(standardRequest());

            expect(result.url).toBe('https://fal.run/seedance-async.mp4');
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('error handling', () => {
        it('throw kalau API key tidak dikonfigurasi', async () => {
            const provider = new Seedance2Provider({});
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('fal.ai API key not configured for Seedance 2');
        });

        it('throw kalau API return error', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Rate limit' }, false, 429),
            );

            const provider = new Seedance2Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Seedance 2 API error (429)');
        });

        it('throw kalau response missing video URL dan request_id', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ /* empty */ }),
            );

            const provider = new Seedance2Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Seedance 2 response missing video URL and request_id');
        });

        it('wrap network error', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

            const provider = new Seedance2Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Seedance 2 request failed: Connection refused');
        });
    });
});

// ---------------------------------------------------------------------------
// Wan2_7Provider Tests
// ---------------------------------------------------------------------------

describe('Wan2_7Provider', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('construction & isAvailable()', () => {
        it('membuat provider dengan API key', () => {
            const provider = new Wan2_7Provider({ apiKey: 'fal-key' });
            expect(provider.name).toBe('wan-2.7');
            expect(provider.isAvailable()).resolves.toBe(true);
        });

        it('isAvailable() return false kalau API key kosong', () => {
            const provider = new Wan2_7Provider({});
            expect(provider.isAvailable()).resolves.toBe(false);
        });
    });

    describe('generateClip() — sync mode', () => {
        it('berhasil generate video dan return URL', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse(syncVideoResponse('https://fal.run/wan-result.mp4')),
            );

            const provider = new Wan2_7Provider({ apiKey: 'fal-key' });
            const result = await provider.generateClip(standardRequest());

            expect(result.providerName).toBe('wan-2.7');
            expect(result.url).toBe('https://fal.run/wan-result.mp4');
            expect(result.cost).toBe(0.25); // default cost
        });
    });

    describe('error handling', () => {
        it('throw kalau API key tidak dikonfigurasi', async () => {
            const provider = new Wan2_7Provider({});
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('API key not configured for Wan 2.7');
        });

        it('throw kalau API return error', async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(
                mockResponse({ error: 'Server error' }, false, 500),
            );

            const provider = new Wan2_7Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Wan 2.7 API error (500)');
        });

        it('wrap network error', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

            const provider = new Wan2_7Provider({ apiKey: 'fal-key' });
            await expect(provider.generateClip(standardRequest()))
                .rejects.toThrow('Wan 2.7 request failed: Timeout');
        });
    });
});

// ---------------------------------------------------------------------------
// createVideoProviderRegistry Tests
// ---------------------------------------------------------------------------

describe('createVideoProviderRegistry', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('membuat registry dengan ketiga provider terdaftar', () => {
        const registry = createVideoProviderRegistry({
            kling3: { apiKey: 'kling-key' },
            seedance2: { apiKey: 'seedance-key' },
            wan2_7: { apiKey: 'wan-key' },
        });
        expect(registry).toBeDefined();
    });

    it('default chain: kling-3.0 → seedance-2 → wan-2.7', async () => {
        // Mock: first call (kling-3.0) succeeds (sync mode)
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockResponse(syncVideoResponse('https://fal.run/chain-primary.mp4')),
        );

        const registry = createVideoProviderRegistry({
            kling3: { apiKey: 'kling-key' },
            seedance2: { apiKey: 'seedance-key' },
            wan2_7: { apiKey: 'wan-key' },
        });

        const { result, providerUsed, attempts } = await registry.generateVideoClip(standardRequest());

        expect(providerUsed).toBe('kling-3.0');
        expect(attempts).toEqual(['kling-3.0']);
        expect(result.url).toBe('https://fal.run/chain-primary.mp4');
    });

    it('fallback ke seedance-2 kalau kling-3.0 gagal', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(mockResponse({ error: 'Kling down' }, false, 500))
            .mockResolvedValueOnce(mockResponse(syncVideoResponse('https://fal.run/chain-fallback1.mp4')));

        globalThis.fetch = fetchMock;

        const registry = createVideoProviderRegistry({
            kling3: { apiKey: 'kling-key' },
            seedance2: { apiKey: 'seedance-key' },
            wan2_7: { apiKey: 'wan-key' },
        });

        const { result, providerUsed, attempts } = await registry.generateVideoClip(standardRequest());

        expect(providerUsed).toBe('seedance-2');
        expect(attempts).toEqual(['kling-3.0', 'seedance-2']);
        expect(result.url).toBe('https://fal.run/chain-fallback1.mp4');
    });

    it('fallback ke wan-2.7 kalau kling-3.0 dan seedance-2 gagal', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(mockResponse({ error: 'Kling down' }, false, 500))
            .mockResolvedValueOnce(mockResponse({ error: 'Seedance down' }, false, 500))
            .mockResolvedValueOnce(mockResponse(syncVideoResponse('https://fal.run/chain-fallback2.mp4')));

        globalThis.fetch = fetchMock;

        const registry = createVideoProviderRegistry({
            kling3: { apiKey: 'kling-key' },
            seedance2: { apiKey: 'seedance-key' },
            wan2_7: { apiKey: 'wan-key' },
        });

        const { result, providerUsed, attempts } = await registry.generateVideoClip(standardRequest());

        expect(providerUsed).toBe('wan-2.7');
        expect(attempts).toEqual(['kling-3.0', 'seedance-2', 'wan-2.7']);
        expect(result.url).toBe('https://fal.run/chain-fallback2.mp4');
    });

    it('skip provider yang unavailable (API key kosong) dan pakai yang available', async () => {
        // kling-3.0 has no API key → isAvailable() = false → skipped (generateClip NOT called)
        // seedance-2 has no API key → isAvailable() = false → skipped (generateClip NOT called)
        // wan-2.7 has API key → used (generateClip called, succeeds)
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockResponse(syncVideoResponse('https://fal.run/no-key-skip.mp4')),
        );

        const registry = createVideoProviderRegistry({
            kling3: {}, // no API key
            seedance2: {}, // no API key
            wan2_7: { apiKey: 'wan-key' },
        });

        const { providerUsed, attempts } = await registry.generateVideoClip(standardRequest());

        // wan-2.7 is the one that actually succeeded
        expect(providerUsed).toBe('wan-2.7');
        expect(attempts).toContain('wan-2.7');

        // kling-3.0 and seedance-2 ARE in attempts (they were found in registry and tried),
        // but their generateClip() was never called (isAvailable() returned false).
        // The registry adds provider name to attempts before checking isAvailable().
        // The key distinction: fetch was only called ONCE (for wan-2.7), not 3 times.
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('throw MediaChainExhaustedError kalau SEMUA provider gagal', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(mockResponse({ error: 'Kling error' }, false, 500))
            .mockResolvedValueOnce(mockResponse({ error: 'Seedance error' }, false, 500))
            .mockResolvedValueOnce(mockResponse({ error: 'Wan error' }, false, 500));

        globalThis.fetch = fetchMock;

        const registry = createVideoProviderRegistry({
            kling3: { apiKey: 'kling-key' },
            seedance2: { apiKey: 'seedance-key' },
            wan2_7: { apiKey: 'wan-key' },
        });

        await expect(registry.generateVideoClip(standardRequest()))
            .rejects.toThrow(MediaChainExhaustedError);
    });

    it('menerima custom chain order', async () => {
        // Custom chain: wan-2.7 first
        globalThis.fetch = vi.fn().mockResolvedValue(
            mockResponse(syncVideoResponse('https://fal.run/custom-chain.mp4')),
        );

        const registry = createVideoProviderRegistry({
            kling3: { apiKey: 'kling-key' },
            seedance2: { apiKey: 'seedance-key' },
            wan2_7: { apiKey: 'wan-key' },
            chain: ['wan-2.7', 'seedance-2', 'kling-3.0'],
        });

        const { providerUsed } = await registry.generateVideoClip(standardRequest());

        expect(providerUsed).toBe('wan-2.7');
    });
});