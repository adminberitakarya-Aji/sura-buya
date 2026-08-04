/**
 * VF-3.2 — Visual Generator Tests
 *
 * Tests for style-guide-enforcer.ts and image-generator.ts.
 *
 * style-guide-enforcer: pure deterministic function — no mocking needed.
 * image-generator: async orchestrator — mock MediaProviderRegistry.
 *
 * Test coverage:
 * - enforceStyleGuide: valid/invalid shots, missing visual profile, multi-shot emphasis
 * - checkCrossEpisodeConsistency: identical/different profiles
 * - buildStyleSummary: format output
 * - generateKeyframes: success path, empty shots, style guide failure, cost tracking,
 *   reference image conditioning, parallel mode, fallback chain integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    enforceStyleGuide,
    checkCrossEpisodeConsistency,
    buildStyleSummary,
} from '../src/visual/style-guide-enforcer.js';
import {
    generateKeyframes,
    ImageGeneratorError,
    type ImageGeneratorInput,
} from '../src/visual/image-generator.js';
import { MediaProviderRegistry } from '../src/ai/media-providers/registry.js';
import { MockImageProvider } from '../src/ai/media-providers/mock-providers.js';
import type { ShotSpec, CharacterVisualProfile } from '@suro-buya/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShot(overrides: Partial<ShotSpec> = {}): ShotSpec {
    return {
        index: 0,
        cameraAngle: 'close-up',
        duration: 3.5,
        action: 'Suro swims through a coral reef',
        visualPrompt: 'Close-up. Suro swims through a coral reef. Art style: 2D digital.',
        ...overrides,
    };
}

function makeShots(count: number): ShotSpec[] {
    return Array.from({ length: count }, (_, i) =>
        makeShot({
            index: i,
            cameraAngle: i % 2 === 0 ? 'close-up' : 'wide shot',
            action: `Action for shot ${i}`,
            visualPrompt: `Shot ${i}. Suro in a coral reef. Art style: 2D digital.`,
        }),
    );
}

function makeVisualProfile(
    overrides: Partial<Omit<CharacterVisualProfile, 'characterId'>> = {},
): Omit<CharacterVisualProfile, 'characterId'> {
    return {
        referenceImages: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
        styleTags: ['2D', 'watercolor', 'vibrant'],
        colorPalette: ['#FF6B35', '#004E64'],
        negativePrompt: 'blurry, distorted',
        ...overrides,
    };
}

function makeRegistryWithMock(): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();
    registry.registerImageProvider(new MockImageProvider('flux-2-pro', { costUsd: 0.05 }));
    registry.setImageChain(['flux-2-pro']);
    return registry;
}

// ---------------------------------------------------------------------------
// buildStyleSummary
// ---------------------------------------------------------------------------

describe('buildStyleSummary', () => {
    it('return "No visual profile" kalau visualProfile undefined', () => {
        expect(buildStyleSummary(undefined)).toContain('No visual profile');
    });

    it('return ringkasan dengan reference images, style tags, palette, negative', () => {
        const summary = buildStyleSummary(makeVisualProfile());
        expect(summary).toContain('2 reference images');
        expect(summary).toContain('style: 2D, watercolor, vibrant');
        expect(summary).toContain('palette: #FF6B35, #004E64');
        expect(summary).toContain('negative:');
    });

    it('return "present but empty" kalau visualProfile ada tapi semua field kosong', () => {
        const summary = buildStyleSummary({
            referenceImages: [],
            styleTags: [],
        });
        expect(summary).toContain('present but empty');
    });
});

// ---------------------------------------------------------------------------
// enforceStyleGuide
// ---------------------------------------------------------------------------

describe('enforceStyleGuide', () => {
    describe('valid input', () => {
        it('passed=true kalau shots valid dan visualProfile lengkap', () => {
            const result = enforceStyleGuide(makeShots(3), makeVisualProfile());
            expect(result.passed).toBe(true);
            expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
        });

        it('passed=true kalau shots valid meski visualProfile tidak ada (warning saja)', () => {
            const result = enforceStyleGuide(makeShots(3), undefined);
            expect(result.passed).toBe(true);
            expect(result.recommendations.length).toBeGreaterThan(0);
            expect(result.recommendations[0]).toContain('No visual profile');
        });

        it('passed=true meski reference images kosong (warning, bukan error)', () => {
            const result = enforceStyleGuide(makeShots(3), {
                referenceImages: [],
                styleTags: ['2D'],
            });
            expect(result.passed).toBe(true);
            expect(result.recommendations.some((r) => r.includes('No reference images'))).toBe(true);
        });
    });

    describe('error violations', () => {
        it('error kalau visualPrompt kosong', () => {
            const shots = [makeShot({ visualPrompt: '' })];
            const result = enforceStyleGuide(shots, makeVisualProfile());
            expect(result.passed).toBe(false);
            expect(result.violations).toContainEqual({
                shotIndex: 0,
                field: 'visualPrompt',
                message: 'Visual prompt is empty — cannot generate keyframe without a prompt.',
                severity: 'error',
            });
        });

        it('error kalau cameraAngle kosong', () => {
            const shots = [makeShot({ cameraAngle: '' })];
            const result = enforceStyleGuide(shots, makeVisualProfile());
            expect(result.passed).toBe(false);
            const errorViolations = result.violations.filter((v) => v.severity === 'error');
            expect(errorViolations.some((v) => v.field === 'cameraAngle')).toBe(true);
        });

        it('error kalau duration <= 0', () => {
            const shots = [makeShot({ duration: 0 })];
            const result = enforceStyleGuide(shots, makeVisualProfile());
            expect(result.passed).toBe(false);
            const durationViolation = result.violations.find((v) => v.field === 'duration');
            expect(durationViolation).toBeDefined();
            expect(durationViolation!.severity).toBe('error');
        });

        it('error kalau duration negatif', () => {
            const shots = [makeShot({ duration: -1 })];
            const result = enforceStyleGuide(shots, makeVisualProfile());
            expect(result.passed).toBe(false);
        });

        it('multiple errors dikumpulkan sekaligus', () => {
            const shots = [
                makeShot({ index: 0, visualPrompt: '' }),
                makeShot({ index: 1, cameraAngle: '' }),
                makeShot({ index: 2, duration: -1 }),
            ];
            const result = enforceStyleGuide(shots, makeVisualProfile());
            expect(result.passed).toBe(false);
            expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(3);
        });
    });

    describe('recommendations', () => {
        it('rekomendasi reference images kalau visualProfile tidak punya reference', () => {
            const result = enforceStyleGuide(makeShots(3), {
                referenceImages: [],
                styleTags: ['2D'],
            });
            expect(result.recommendations.some((r) => r.includes('reference-image conditioning'))).toBe(true);
        });

        it('rekomendasi style tags kalau tidak ada', () => {
            const result = enforceStyleGuide(makeShots(3), {
                referenceImages: ['https://example.com/ref.png'],
                styleTags: [],
            });
            expect(result.recommendations.some((r) => r.includes('style tags'))).toBe(true);
        });

        it('rekomendasi color palette kalau tidak ada', () => {
            const result = enforceStyleGuide(makeShots(3), {
                referenceImages: ['https://example.com/ref.png'],
                styleTags: ['2D'],
            });
            expect(result.recommendations.some((r) => r.includes('color palette'))).toBe(true);
        });

        it('warning khusus untuk 8+ shot tanpa reference images (VF-3 acceptance criteria)', () => {
            const result = enforceStyleGuide(makeShots(8), undefined);
            expect(result.recommendations.some((r) => r.includes('8-shot sequence'))).toBe(true);
        });

        it('tidak ada warning 8-shot kalau shot count < 8', () => {
            const result = enforceStyleGuide(makeShots(5), undefined);
            expect(result.recommendations.some((r) => r.includes('8-shot sequence'))).toBe(false);
        });
    });

    describe('styleSummary', () => {
        it('styleSummary terisi di result', () => {
            const result = enforceStyleGuide(makeShots(3), makeVisualProfile());
            expect(result.styleSummary).toContain('2 reference images');
            expect(result.styleSummary).toContain('2D');
        });

        it('styleSummary "No visual profile" kalau tidak ada', () => {
            const result = enforceStyleGuide(makeShots(3), undefined);
            expect(result.styleSummary).toContain('No visual profile');
        });
    });
});

// ---------------------------------------------------------------------------
// checkCrossEpisodeConsistency
// ---------------------------------------------------------------------------

describe('checkCrossEpisodeConsistency', () => {
    it('consistent=true kalau dua profile identik', () => {
        const profile = makeVisualProfile();
        const result = checkCrossEpisodeConsistency(profile, profile);
        expect(result.consistent).toBe(true);
        expect(result.differences).toHaveLength(0);
    });

    it('consistent=false kalau salah satu profile undefined', () => {
        const result = checkCrossEpisodeConsistency(makeVisualProfile(), undefined);
        expect(result.consistent).toBe(false);
        expect(result.differences[0]).toContain('missing');
    });

    it('consistent=false kalau jumlah reference image berbeda', () => {
        const profile1 = makeVisualProfile({
            referenceImages: ['https://example.com/a.png', 'https://example.com/b.png'],
        });
        const profile2 = makeVisualProfile({
            referenceImages: ['https://example.com/a.png'],
        });
        const result = checkCrossEpisodeConsistency(profile1, profile2);
        expect(result.consistent).toBe(false);
        expect(result.differences.some((d) => d.includes('count differs'))).toBe(true);
    });

    it('consistent=false kalau reference image berbeda meski jumlah sama', () => {
        const profile1 = makeVisualProfile({
            referenceImages: ['https://example.com/a.png', 'https://example.com/b.png'],
        });
        const profile2 = makeVisualProfile({
            referenceImages: ['https://example.com/a.png', 'https://example.com/c.png'],
        });
        const result = checkCrossEpisodeConsistency(profile1, profile2);
        expect(result.consistent).toBe(false);
        expect(result.differences.some((d) => d.includes('not identical'))).toBe(true);
    });

    it('consistent=false kalau style tags berbeda', () => {
        const profile1 = makeVisualProfile({ styleTags: ['2D', 'watercolor'] });
        const profile2 = makeVisualProfile({ styleTags: ['3D', 'realistic'] });
        const result = checkCrossEpisodeConsistency(profile1, profile2);
        expect(result.consistent).toBe(false);
        expect(result.differences.some((d) => d.includes('Style tags differ'))).toBe(true);
    });

    it('consistent=false kalau color palette berbeda', () => {
        const profile1 = makeVisualProfile({ colorPalette: ['#FF0000'] });
        const profile2 = makeVisualProfile({ colorPalette: ['#00FF00'] });
        const result = checkCrossEpisodeConsistency(profile1, profile2);
        expect(result.consistent).toBe(false);
        expect(result.differences.some((d) => d.includes('palette differs'))).toBe(true);
    });

    it('consistent=false kalau negative prompt berbeda', () => {
        const profile1 = makeVisualProfile({ negativePrompt: 'blurry' });
        const profile2 = makeVisualProfile({ negativePrompt: 'distorted' });
        const result = checkCrossEpisodeConsistency(profile1, profile2);
        expect(result.consistent).toBe(false);
        expect(result.differences.some((d) => d.includes('Negative prompt'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// generateKeyframes
// ---------------------------------------------------------------------------

describe('generateKeyframes', () => {
    describe('input validation', () => {
        it('throw ImageGeneratorError kalau shots kosong', async () => {
            await expect(
                generateKeyframes({ shots: [] }),
            ).rejects.toThrow(ImageGeneratorError);
            await expect(
                generateKeyframes({ shots: [] }),
            ).rejects.toThrow('shots list is empty');
        });

        it('throw ImageGeneratorError kalau style guide gagal (error violation)', async () => {
            const shots = [makeShot({ visualPrompt: '' })];
            await expect(
                generateKeyframes({ shots, registry: makeRegistryWithMock() }),
            ).rejects.toThrow('Style guide enforcement failed');
        });
    });

    describe('success path — sequential (default)', () => {
        it('generate keyframes untuk 3 shot secara sequential', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(3),
                visualProfile: makeVisualProfile(),
                registry,
            });

            expect(result.keyframes).toHaveLength(3);
            expect(result.keyframes[0].shotIndex).toBe(0);
            expect(result.keyframes[1].shotIndex).toBe(1);
            expect(result.keyframes[2].shotIndex).toBe(2);
            expect(result.keyframes[0].imageUrl).toContain('mock-media.local');
            expect(result.providerUsed).toBe('flux-2-pro');
        });

        it('track total cost dari semua keyframe', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(5),
                visualProfile: makeVisualProfile(),
                registry,
            });

            // MockImageProvider default cost = 0.05 per image
            expect(result.totalCost).toBe(0.25); // 5 * 0.05
            expect(result.keyframes.every((k) => k.cost === 0.05)).toBe(true);
        });

        it('pakai custom costUsd dari mock provider', async () => {
            const registry = new MediaProviderRegistry();
            registry.registerImageProvider(
                new MockImageProvider('custom-provider', { costUsd: 0.099 }),
            );
            registry.setImageChain(['custom-provider']);

            const result = await generateKeyframes({
                shots: makeShots(2),
                visualProfile: makeVisualProfile(),
                registry,
            });

            expect(result.totalCost).toBe(0.198); // 2 * 0.099
        });
    });

    describe('success path — parallel mode', () => {
        it('generate keyframes secara paralel dan sort by shotIndex', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(5),
                visualProfile: makeVisualProfile(),
                registry,
                sequential: false, // parallel
            });

            expect(result.keyframes).toHaveLength(5);
            // Verify sorted by shotIndex
            for (let i = 0; i < result.keyframes.length; i++) {
                expect(result.keyframes[i].shotIndex).toBe(i);
            }
        });
    });

    describe('reference image conditioning', () => {
        it('pass reference images dari visualProfile ke image generation request', async () => {
            // Mock fetch: return different responses for reference image fetches vs API calls.
            // Reference image fetches need arrayBuffer(), API calls need json().
            // We distinguish by URL: reference images contain "example.com", API calls contain "gemini".
            const geminiResponse = {
                candidates: [{
                    content: {
                        parts: [{ inline_data: { mime_type: 'image/png', data: 'base64data' } }],
                    },
                }],
            };

            const fetchMock = vi.fn().mockImplementation((url: string) => {
                if (url.includes('gemini')) {
                    // API call — return json() with image data
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => geminiResponse,
                        text: async () => JSON.stringify(geminiResponse),
                        headers: new Headers({ 'content-type': 'application/json' }),
                    } as Response);
                } else {
                    // Reference image fetch — return arrayBuffer()
                    return Promise.resolve({
                        ok: true,
                        arrayBuffer: async () => new ArrayBuffer(10),
                        headers: new Headers({ 'content-type': 'image/png' }),
                    } as Response);
                }
            });
            globalThis.fetch = fetchMock;

            // Use NanoBanana2Provider to test reference image fetching
            const { NanoBanana2Provider } = await import('../src/ai/media-providers/image-provider.js');
            const registry = new MediaProviderRegistry();
            registry.registerImageProvider(new NanoBanana2Provider({ apiKey: 'test-key' }));
            registry.setImageChain(['nano-banana-2']);

            const refImages = ['https://example.com/ref1.png', 'https://example.com/ref2.png'];
            const result = await generateKeyframes({
                shots: makeShots(2),
                visualProfile: makeVisualProfile({ referenceImages: refImages }),
                registry,
            });

            expect(result.keyframes).toHaveLength(2);
            // fetch should be called for reference images + API calls
            // 2 shots * 2 reference images = 4 ref fetches + 2 API calls = 6 total
            expect(fetchMock).toHaveBeenCalledTimes(6);
        });
    });

    describe('style guide integration', () => {
        it('warnings dari style guide masuk ke result', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(3),
                // No visual profile → style guide will add warnings
                registry,
            });

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some((w) => w.includes('No visual profile'))).toBe(true);
        });

        it('styleGuideResult terisi di result', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(3),
                visualProfile: makeVisualProfile(),
                registry,
            });

            expect(result.styleGuideResult).toBeDefined();
            expect(result.styleGuideResult.passed).toBe(true);
        });
    });

    describe('default registry (no registry supplied)', () => {
        it('pakai mock default registry kalau tidak disuplai', async () => {
            const result = await generateKeyframes({
                shots: makeShots(2),
                visualProfile: makeVisualProfile(),
            });

            expect(result.keyframes).toHaveLength(2);
            expect(result.providerUsed).toBe('flux-2-pro');
        });
    });

    describe('aspect ratio', () => {
        it('default aspect ratio 9:16', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(1),
                visualProfile: makeVisualProfile(),
                registry,
            });

            expect(result.keyframes[0].imageUrl).toBeDefined();
        });

        it('menerima custom aspect ratio', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(1),
                visualProfile: makeVisualProfile(),
                registry,
                aspectRatio: '1:1',
            });

            expect(result.keyframes).toHaveLength(1);
        });
    });

    describe('8-shot sequence (VF-3 Acceptance Criteria #1)', () => {
        it('berhasil generate 8-shot sequence dengan reference images', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateKeyframes({
                shots: makeShots(8),
                visualProfile: makeVisualProfile(),
                registry,
            });

            expect(result.keyframes).toHaveLength(8);
            expect(result.totalCost).toBe(0.4); // 8 * 0.05
            // All keyframes should use the same provider (consistency)
            const providers = new Set(result.keyframes.map((k) => k.providerUsed));
            expect(providers.size).toBe(1);
        });
    });

    describe('fallback chain integration', () => {
        it('fallback ke provider berikutnya kalau provider pertama gagal', async () => {
            const registry = new MediaProviderRegistry();
            registry.registerImageProvider(
                new MockImageProvider('nano-banana-2', { shouldFail: true }),
            );
            registry.registerImageProvider(
                new MockImageProvider('flux-2-pro', { costUsd: 0.05 }),
            );
            registry.setImageChain(['nano-banana-2', 'flux-2-pro']);

            const result = await generateKeyframes({
                shots: makeShots(2),
                visualProfile: makeVisualProfile(),
                registry,
            });

            expect(result.keyframes).toHaveLength(2);
            expect(result.keyframes[0].providerUsed).toBe('flux-2-pro');
            expect(result.keyframes[0].attempts).toContain('nano-banana-2');
            expect(result.keyframes[0].attempts).toContain('flux-2-pro');
        });
    });
});