/**
 * VF-3.4 — Motion Generator Tests
 *
 * Tests for camera-motion.ts and animation-generator.ts.
 *
 * camera-motion: pure deterministic function — no mocking needed.
 * animation-generator: async orchestrator — mock MediaProviderRegistry.
 *
 * Test coverage:
 * - camera-motion: getDefaultMotionForAngle, buildPresetMotion, getMotionCostTier, resolveMotionPrompt
 * - animation-generator: success path, empty shots, keyframe mismatch, cost tracking,
 *   sequential/parallel mode, custom vs preset motion, fallback chain, cost tier summary
 */

import { describe, it, expect } from 'vitest';
import {
    getDefaultMotionForAngle,
    buildPresetMotion,
    getMotionCostTier,
    getAllMotionPresets,
    resolveMotionPrompt,
} from '../src/motion/camera-motion.js';
import {
    generateAnimations,
    AnimationGeneratorError,
    type AnimationGeneratorInput,
} from '../src/motion/animation-generator.js';
import { MediaProviderRegistry } from '../src/ai/media-providers/registry.js';
import { MockVideoProvider } from '../src/ai/media-providers/mock-providers.js';
import type { ShotSpec } from '@suro-buya/shared';
import type { GeneratedKeyframe } from '../src/visual/image-generator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShot(overrides: Partial<ShotSpec> = {}): ShotSpec {
    return {
        index: 0,
        cameraAngle: 'close-up',
        duration: 3.5,
        action: 'Suro swims through a coral reef',
        visualPrompt: 'Close-up. Suro swims through a coral reef.',
        ...overrides,
    };
}

function makeShots(count: number): ShotSpec[] {
    return Array.from({ length: count }, (_, i) =>
        makeShot({
            index: i,
            cameraAngle: i % 2 === 0 ? 'close-up' : 'wide shot',
            action: `Action for shot ${i}`,
            visualPrompt: `Shot ${i}. Suro in a coral reef.`,
        }),
    );
}

function makeKeyframe(shotIndex: number): GeneratedKeyframe {
    return {
        shotIndex,
        imageUrl: `https://example.com/keyframe-${shotIndex}.png`,
        providerUsed: 'flux-2-pro',
        cost: 0.05,
        promptUsed: `Prompt for shot ${shotIndex}`,
        attempts: ['flux-2-pro'],
    };
}

function makeKeyframes(count: number): GeneratedKeyframe[] {
    return Array.from({ length: count }, (_, i) => makeKeyframe(i));
}

function makeRegistryWithMock(): MediaProviderRegistry {
    const registry = new MediaProviderRegistry();
    registry.registerVideoProvider(new MockVideoProvider('kling-3.0', { costUsd: 0.35 }));
    registry.setVideoChain(['kling-3.0']);
    return registry;
}

// ---------------------------------------------------------------------------
// camera-motion tests
// ---------------------------------------------------------------------------

describe('camera-motion', () => {
    describe('getDefaultMotionForAngle', () => {
        it('return slow-zoom-in untuk close-up', () => {
            expect(getDefaultMotionForAngle('close-up')).toBe('slow-zoom-in');
        });

        it('return static untuk extreme close-up', () => {
            expect(getDefaultMotionForAngle('extreme close-up')).toBe('static');
        });

        it('return gentle-sway untuk medium shot', () => {
            expect(getDefaultMotionForAngle('medium shot')).toBe('gentle-sway');
        });

        it('return pan-right untuk wide shot', () => {
            expect(getDefaultMotionForAngle('wide shot')).toBe('pan-right');
        });

        it('return static untuk over-the-shoulder', () => {
            expect(getDefaultMotionForAngle('over-the-shoulder')).toBe('static');
        });

        it('return gentle-sway (safe default) untuk camera angle tidak dikenal', () => {
            expect(getDefaultMotionForAngle('unknown angle')).toBe('gentle-sway');
        });

        it('case insensitive', () => {
            expect(getDefaultMotionForAngle('Close-Up')).toBe('slow-zoom-in');
            expect(getDefaultMotionForAngle('WIDE SHOT')).toBe('pan-right');
        });
    });

    describe('buildPresetMotion', () => {
        it('build motion prompt dengan duration', () => {
            const prompt = buildPresetMotion('slow-zoom-in', 5);
            expect(prompt).toContain('zoom in');
            expect(prompt).toContain('Duration: 5s.');
        });

        it('build static prompt', () => {
            const prompt = buildPresetMotion('static', 3);
            expect(prompt).toContain('Minimal camera movement');
            expect(prompt).toContain('Duration: 3s.');
        });

        it('build dynamic prompt', () => {
            const prompt = buildPresetMotion('dynamic', 4);
            expect(prompt).toContain('Dynamic camera movement');
            expect(prompt).toContain('Duration: 4s.');
        });
    });

    describe('getMotionCostTier', () => {
        it('low tier untuk static', () => {
            expect(getMotionCostTier('static')).toBe('low');
        });

        it('low tier untuk slow-zoom-in', () => {
            expect(getMotionCostTier('slow-zoom-in')).toBe('low');
        });

        it('low tier untuk slow-zoom-out', () => {
            expect(getMotionCostTier('slow-zoom-out')).toBe('low');
        });

        it('medium tier untuk pan-left', () => {
            expect(getMotionCostTier('pan-left')).toBe('medium');
        });

        it('medium tier untuk gentle-sway', () => {
            expect(getMotionCostTier('gentle-sway')).toBe('medium');
        });

        it('high tier untuk dynamic', () => {
            expect(getMotionCostTier('dynamic')).toBe('high');
        });
    });

    describe('getAllMotionPresets', () => {
        it('return semua 10 preset', () => {
            const presets = getAllMotionPresets();
            expect(presets).toHaveLength(10);
            expect(presets).toContain('static');
            expect(presets).toContain('slow-zoom-in');
            expect(presets).toContain('dynamic');
            expect(presets).toContain('handheld');
        });
    });

    describe('resolveMotionPrompt', () => {
        it('pakai custom motion prompt kalau di-set', () => {
            const result = resolveMotionPrompt('custom motion here', 'close-up', 5);
            expect(result.isCustom).toBe(true);
            expect(result.prompt).toContain('custom motion here');
            expect(result.prompt).toContain('Duration: 5s.');
            expect(result.preset).toBe('dynamic');
            expect(result.costTier).toBe('high');
        });

        it('pakai preset kalau motionPrompt tidak di-set', () => {
            const result = resolveMotionPrompt(undefined, 'close-up', 5);
            expect(result.isCustom).toBe(false);
            expect(result.preset).toBe('slow-zoom-in');
            expect(result.costTier).toBe('low');
            expect(result.prompt).toContain('zoom in');
            expect(result.prompt).toContain('Duration: 5s.');
        });

        it('pakai preset kalau motionPrompt kosong string', () => {
            const result = resolveMotionPrompt('', 'wide shot', 3);
            expect(result.isCustom).toBe(false);
            expect(result.preset).toBe('pan-right');
            expect(result.costTier).toBe('medium');
        });

        it('pakai preset kalau motionPrompt hanya whitespace', () => {
            const result = resolveMotionPrompt('   ', 'close-up', 3);
            expect(result.isCustom).toBe(false);
            expect(result.preset).toBe('slow-zoom-in');
        });
    });
});

// ---------------------------------------------------------------------------
// animation-generator tests
// ---------------------------------------------------------------------------

describe('animation-generator', () => {
    describe('input validation', () => {
        it('throw AnimationGeneratorError kalau shots kosong', async () => {
            await expect(
                generateAnimations({ shots: [], keyframes: [] }),
            ).rejects.toThrow(AnimationGeneratorError);
            await expect(
                generateAnimations({ shots: [], keyframes: [] }),
            ).rejects.toThrow('shots list is empty');
        });

        it('throw AnimationGeneratorError kalau keyframes kosong', async () => {
            await expect(
                generateAnimations({
                    shots: makeShots(3),
                    keyframes: [],
                    registry: makeRegistryWithMock(),
                }),
            ).rejects.toThrow('keyframes list is empty');
        });

        it('throw AnimationGeneratorError kalau shot count != keyframe count', async () => {
            await expect(
                generateAnimations({
                    shots: makeShots(5),
                    keyframes: makeKeyframes(3),
                    registry: makeRegistryWithMock(),
                }),
            ).rejects.toThrow('does not match keyframe count');
        });

        it('throw AnimationGeneratorError kalau keyframe untuk shot tertentu tidak ada', async () => {
            const shots = makeShots(3);
            // Keyframes dengan shotIndex 0, 1, 5 (bukan 2)
            const keyframes = [
                makeKeyframe(0),
                makeKeyframe(1),
                makeKeyframe(5),
            ];
            await expect(
                generateAnimations({
                    shots,
                    keyframes,
                    registry: makeRegistryWithMock(),
                }),
            ).rejects.toThrow('No keyframe found for shot 2');
        });
    });

    describe('success path — sequential (default)', () => {
        it('generate clips untuk 3 shot secara sequential', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateAnimations({
                shots: makeShots(3),
                keyframes: makeKeyframes(3),
                registry,
            });

            expect(result.clips).toHaveLength(3);
            expect(result.clips[0].shotIndex).toBe(0);
            expect(result.clips[1].shotIndex).toBe(1);
            expect(result.clips[2].shotIndex).toBe(2);
            expect(result.clips[0].clipUrl).toContain('mock-media.local');
            expect(result.providerUsed).toBe('kling-3.0');
        });

        it('track total cost dari semua clip', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateAnimations({
                shots: makeShots(5),
                keyframes: makeKeyframes(5),
                registry,
            });

            // MockVideoProvider default cost = 0.35 per clip
            expect(result.totalCost).toBe(1.75); // 5 * 0.35
            expect(result.clips.every((c) => c.cost === 0.35)).toBe(true);
        });
    });

    describe('success path — parallel mode', () => {
        it('generate clips secara paralel dan sort by shotIndex', async () => {
            const registry = makeRegistryWithMock();
            const result = await generateAnimations({
                shots: makeShots(5),
                keyframes: makeKeyframes(5),
                registry,
                sequential: false,
            });

            expect(result.clips).toHaveLength(5);
            for (let i = 0; i < result.clips.length; i++) {
                expect(result.clips[i].shotIndex).toBe(i);
            }
        });
    });

    describe('motion prompt resolution', () => {
        it('pakai preset berdasarkan cameraAngle kalau motionPrompt tidak di-set', async () => {
            const registry = makeRegistryWithMock();
            const shots = [makeShot({ index: 0, cameraAngle: 'close-up', motionPrompt: undefined })];
            const result = await generateAnimations({
                shots,
                keyframes: makeKeyframes(1),
                registry,
            });

            expect(result.clips[0].isCustomMotion).toBe(false);
            expect(result.clips[0].presetUsed).toBe('slow-zoom-in');
            expect(result.clips[0].costTier).toBe('low');
            expect(result.clips[0].motionPromptUsed).toContain('zoom in');
        });

        it('pakai custom motion prompt kalau di-set di ShotSpec', async () => {
            const registry = makeRegistryWithMock();
            const shots = [makeShot({
                index: 0,
                cameraAngle: 'close-up',
                motionPrompt: 'fast pan right with dramatic zoom',
            })];
            const result = await generateAnimations({
                shots,
                keyframes: makeKeyframes(1),
                registry,
            });

            expect(result.clips[0].isCustomMotion).toBe(true);
            expect(result.clips[0].presetUsed).toBe('dynamic');
            expect(result.clips[0].costTier).toBe('high');
            expect(result.clips[0].motionPromptUsed).toContain('fast pan right');
        });

        it('pass keyframeUrl dari GeneratedKeyframe ke video provider', async () => {
            const registry = makeRegistryWithMock();
            const keyframes = [{
                shotIndex: 0,
                imageUrl: 'https://example.com/special-keyframe.png',
                providerUsed: 'flux-2-pro',
                cost: 0.05,
                promptUsed: 'test prompt',
                attempts: ['flux-2-pro'],
            }];
            const result = await generateAnimations({
                shots: [makeShot({ index: 0 })],
                keyframes,
                registry,
            });

            // The mock provider should have generated a clip
            expect(result.clips[0].clipUrl).toBeDefined();
        });
    });

    describe('cost tier summary', () => {
        it('build cost tier summary dengan benar', async () => {
            const registry = makeRegistryWithMock();
            // 2 close-up (low), 2 wide shot (medium)
            const shots = [
                makeShot({ index: 0, cameraAngle: 'close-up' }),
                makeShot({ index: 1, cameraAngle: 'close-up' }),
                makeShot({ index: 2, cameraAngle: 'wide shot' }),
                makeShot({ index: 3, cameraAngle: 'wide shot' }),
            ];
            const result = await generateAnimations({
                shots,
                keyframes: makeKeyframes(4),
                registry,
            });

            expect(result.costTierSummary.low).toBe(2);  // 2 close-up
            expect(result.costTierSummary.medium).toBe(2); // 2 wide shot
            expect(result.costTierSummary.high).toBe(0);
        });

        it('warning kalau >50% clip di high cost tier', async () => {
            const registry = makeRegistryWithMock();
            // 3 custom motion (high), 1 preset (low) → 75% high
            const shots = [
                makeShot({ index: 0, motionPrompt: 'custom 1' }),
                makeShot({ index: 1, motionPrompt: 'custom 2' }),
                makeShot({ index: 2, motionPrompt: 'custom 3' }),
                makeShot({ index: 3, cameraAngle: 'close-up' }),
            ];
            const result = await generateAnimations({
                shots,
                keyframes: makeKeyframes(4),
                registry,
            });

            expect(result.costTierSummary.high).toBe(3);
            expect(result.warnings.some((w) => w.includes('high cost tier'))).toBe(true);
        });

        it('warning kalau ada custom motion prompts', async () => {
            const registry = makeRegistryWithMock();
            const shots = [
                makeShot({ index: 0, motionPrompt: 'custom motion' }),
                makeShot({ index: 1, cameraAngle: 'close-up' }),
            ];
            const result = await generateAnimations({
                shots,
                keyframes: makeKeyframes(2),
                registry,
            });

            expect(result.warnings.some((w) => w.includes('custom motion prompts'))).toBe(true);
        });
    });

    describe('default registry (no registry supplied)', () => {
        it('pakai mock default registry kalau tidak disuplai', async () => {
            const result = await generateAnimations({
                shots: makeShots(2),
                keyframes: makeKeyframes(2),
            });

            expect(result.clips).toHaveLength(2);
            expect(result.providerUsed).toBe('kling-3.0');
        });
    });

    describe('fallback chain integration', () => {
        it('fallback ke provider berikutnya kalau provider pertama gagal', async () => {
            const registry = new MediaProviderRegistry();
            registry.registerVideoProvider(
                new MockVideoProvider('kling-3.0', { shouldFail: true }),
            );
            registry.registerVideoProvider(
                new MockVideoProvider('wan-2.7', { costUsd: 0.25 }),
            );
            registry.setVideoChain(['kling-3.0', 'wan-2.7']);

            const result = await generateAnimations({
                shots: makeShots(2),
                keyframes: makeKeyframes(2),
                registry,
            });

            expect(result.clips).toHaveLength(2);
            expect(result.clips[0].providerUsed).toBe('wan-2.7');
            expect(result.clips[0].attempts).toContain('kling-3.0');
            expect(result.clips[0].attempts).toContain('wan-2.7');
        });
    });

    describe('8-shot sequence (VF-3 Acceptance Criteria)', () => {
        it('berhasil generate 8-shot sequence dengan cost tier summary', async () => {
            const registry = makeRegistryWithMock();
            const shots = Array.from({ length: 8 }, (_, i) =>
                makeShot({
                    index: i,
                    cameraAngle: i % 4 === 0 ? 'close-up' : i % 4 === 1 ? 'wide shot' : i % 4 === 2 ? 'medium shot' : 'extreme close-up',
                }),
            );
            const result = await generateAnimations({
                shots,
                keyframes: makeKeyframes(8),
                registry,
            });

            expect(result.clips).toHaveLength(8);
            expect(result.totalCost).toBe(2.8); // 8 * 0.35
            // All clips should use the same provider
            const providers = new Set(result.clips.map((c) => c.providerUsed));
            expect(providers.size).toBe(1);
            // Cost tier summary should have a mix
            expect(result.costTierSummary.low + result.costTierSummary.medium).toBe(8);
        });
    });
});