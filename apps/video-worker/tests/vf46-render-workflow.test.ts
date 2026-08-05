/**
 * Suro-Buya Video Worker — VF-4.6/VF-4.7 Render Workflow Integration Tests
 *
 * Test suite untuk workflow renderWorkflow menggunakan @temporalio/testing
 * (TestWorkflowEnvironment) — sama pola dengan vf35-temporal-workflow.test.ts:
 * menjalankan workflow TANPA memerlukan Temporal server nyata.
 *
 * Skenario yang diverifikasi:
 * - Happy path: BUILDING_TIMELINE → RENDERING_REMOTION → ENCODING_FFMPEG → DONE,
 *   VideoRender + VideoRenderJob ter-update dengan benar per step.
 * - Retry: activity gagal di attempt 1, workflow retry attempt 2, akhirnya sukses.
 * - Gagal total: semua attempt (maxAttempts) gagal → status FAILED, error terekam.
 * - Cancel signal: workflow di-cancel di tengah proses → status FAILED dengan
 *   pesan "Cancelled by user".
 * - Multi-platform: satu render request untuk >1 platform meng-encode semuanya.
 *
 * CATATAN PENTING (temuan audit sebelum file ini ditulis): sebelum ada file
 * test ini, render activities (buildTimelineActivity, renderRemotionActivity,
 * dkk di render-activities.ts) TIDAK PERNAH didaftarkan ke `activities` object
 * di activities/index.ts — artinya Temporal Worker asli tidak pernah tahu
 * activity-activity ini ada, dan renderWorkflow akan gagal runtime dengan
 * error "activity not registered" meski workflow-nya berhasil di-start dari
 * apps/web. Ini sudah diperbaiki di activities/index.ts sebelum test ini
 * ditulis — lihat commit terkait.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, Runtime, DefaultLogger } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { renderWorkflow, getRenderStatus, cancelRenderSignal } from '../src/workflows/render-workflow.js';
import type { RenderWorkflowInput } from '../src/shared/render-interfaces.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test environment setup
// ─────────────────────────────────────────────────────────────────────────────

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
    Runtime.install({
        logger: new DefaultLogger('WARN'),
    });
    testEnv = await TestWorkflowEnvironment.createLocal();
}, 60_000);

afterAll(async () => {
    await testEnv?.teardown();
}, 30_000);

async function createTestWorker(
    mockActivities: Record<string, (...args: unknown[]) => unknown>,
): Promise<Worker> {
    return await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: 'default',
        taskQueue: 'vf46-render-test-queue',
        workflowsPath: fileURLToPath(new URL('../src/workflows/render-workflow.ts', import.meta.url)),
        activities: mockActivities,
    });
}

function buildRenderInput(overrides: Partial<RenderWorkflowInput> = {}): RenderWorkflowInput {
    return {
        videoRenderId: 'render-test-001',
        projectId: 'project-test-001',
        platforms: ['TIKTOK'],
        maxAttempts: 3,
        ...overrides,
    };
}

const FAKE_TIMELINE_JSON = JSON.stringify({
    videoTrack: [],
    audioTrack: [],
    subtitleTrack: [],
    totalDuration: 15,
    platforms: ['TIKTOK'],
    preset: { width: 1080, height: 1920 },
    warnings: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('renderWorkflow: happy path', () => {
    it('should complete BUILDING_TIMELINE → RENDERING_REMOTION → ENCODING_FFMPEG → DONE', async () => {
        const renderStatusUpdates: Array<Record<string, unknown>> = [];
        const jobUpserts: Array<Record<string, unknown>> = [];

        const mockActivities = {
            buildTimeline: async () => ({
                timelineJson: FAKE_TIMELINE_JSON,
                totalDuration: 15,
                width: 1080,
                height: 1920,
            }),
            renderRemotion: async () => ({
                rawVideoPath: '/tmp/render-test-001-raw.mp4',
                duration: 15,
            }),
            encodeFfmpeg: async (input: { platform: string }) => ({
                outputPath: `/tmp/render-test-001-${input.platform.toLowerCase()}.mp4`,
                fileSizeBytes: 3_500_000,
                resolution: '1080x1920',
                duration: 15,
            }),
            updateVideoRenderStatus: async (input: Record<string, unknown>) => {
                renderStatusUpdates.push(input);
            },
            upsertVideoRenderJob: async (input: Record<string, unknown>) => {
                jobUpserts.push(input);
            },
            getVideoRenderJob: async () => null,
        };

        const worker = await createTestWorker(mockActivities as Record<string, (...args: unknown[]) => unknown>);
        const client = testEnv.client;

        const result = await worker.runUntil(
            client.workflow.execute(renderWorkflow, {
                workflowId: 'test-render-happy-001',
                taskQueue: 'vf46-render-test-queue',
                args: [buildRenderInput()],
            }),
        );

        // Assert — hasil akhir workflow
        expect(result.status).toBe('DONE');
        expect(result.videoRenderId).toBe('render-test-001');
        expect(result.platforms).toHaveLength(1);
        expect(result.platforms[0]).toMatchObject({
            platform: 'TIKTOK',
            videoUrl: 'file:///tmp/render-test-001-tiktok.mp4',
            fileSizeBytes: 3_500_000,
        });

        // Assert — VideoRender di-update ke DONE di akhir
        const finalStatusUpdate = renderStatusUpdates[renderStatusUpdates.length - 1];
        expect(finalStatusUpdate?.['status']).toBe('DONE');

        // Assert — VideoRenderJob attempt 1 tercatat RENDERING lalu DONE
        expect(jobUpserts[0]).toMatchObject({ attemptNumber: 1, status: 'RENDERING' });
        expect(jobUpserts[jobUpserts.length - 1]).toMatchObject({
            attemptNumber: 1,
            status: 'DONE',
        });
    }, 30_000);

    it('should encode every platform when multiple platforms requested', async () => {
        const encodedPlatforms: string[] = [];

        const mockActivities = {
            buildTimeline: async () => ({
                timelineJson: FAKE_TIMELINE_JSON,
                totalDuration: 15,
                width: 1080,
                height: 1920,
            }),
            renderRemotion: async () => ({
                rawVideoPath: '/tmp/raw.mp4',
                duration: 15,
            }),
            encodeFfmpeg: async (input: { platform: string }) => {
                encodedPlatforms.push(input.platform);
                return {
                    outputPath: `/tmp/out-${input.platform.toLowerCase()}.mp4`,
                    fileSizeBytes: 1_000_000,
                    resolution: '1080x1920',
                    duration: 15,
                };
            },
            updateVideoRenderStatus: async () => {},
            upsertVideoRenderJob: async () => {},
            getVideoRenderJob: async () => null,
        };

        const worker = await createTestWorker(mockActivities as Record<string, (...args: unknown[]) => unknown>);
        const client = testEnv.client;

        const result = await worker.runUntil(
            client.workflow.execute(renderWorkflow, {
                workflowId: 'test-render-multiplatform-001',
                taskQueue: 'vf46-render-test-queue',
                args: [buildRenderInput({ platforms: ['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS'] })],
            }),
        );

        expect(encodedPlatforms).toEqual(['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS']);
        expect(result.platforms).toHaveLength(3);
    }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Retry: gagal di attempt 1, sukses di attempt 2
// ─────────────────────────────────────────────────────────────────────────────

describe('renderWorkflow: retry behaviour', () => {
    it('should retry after transient failure and succeed on attempt 2', async () => {
        let encodeCallCount = 0;
        const jobUpserts: Array<Record<string, unknown>> = [];

        const mockActivities = {
            buildTimeline: async () => ({
                timelineJson: FAKE_TIMELINE_JSON,
                totalDuration: 15,
                width: 1080,
                height: 1920,
            }),
            renderRemotion: async () => ({
                rawVideoPath: '/tmp/raw.mp4',
                duration: 15,
            }),
            // Activity retry policy: maximumAttempts=3 (dari config.ts).
            // Untuk trigger workflow-level retry, activity harus gagal SEMUA
            // 3 activity retry attempts di workflow attempt 1 (total 3 calls),
            // lalu sukses di workflow attempt 2 (call ke-4).
            encodeFfmpeg: async () => {
                encodeCallCount++;
                if (encodeCallCount <= 3) {
                    throw new Error('FFmpeg not available — transient');
                }
                return {
                    outputPath: '/tmp/out.mp4',
                    fileSizeBytes: 2_000_000,
                    resolution: '1080x1920',
                    duration: 15,
                };
            },
            updateVideoRenderStatus: async () => {},
            upsertVideoRenderJob: async (input: Record<string, unknown>) => {
                jobUpserts.push(input);
            },
            getVideoRenderJob: async () => null,
        };

        const worker = await createTestWorker(mockActivities as Record<string, (...args: unknown[]) => unknown>);
        const client = testEnv.client;

        const result = await worker.runUntil(
            client.workflow.execute(renderWorkflow, {
                workflowId: 'test-render-retry-001',
                taskQueue: 'vf46-render-test-queue',
                args: [buildRenderInput({ maxAttempts: 3 })],
            }),
        );

        expect(result.status).toBe('DONE');
        // 3 calls gagal (activity retries di workflow attempt 1) + 1 call sukses (workflow attempt 2)
        expect(encodeCallCount).toBe(4);

        // Attempt 1 harus tercatat FAILED, attempt 2 DONE
        const attempt1Failed = jobUpserts.find(
            (j) => j['attemptNumber'] === 1 && j['status'] === 'FAILED',
        );
        const attempt2Done = jobUpserts.find(
            (j) => j['attemptNumber'] === 2 && j['status'] === 'DONE',
        );
        expect(attempt1Failed).toBeDefined();
        expect(attempt2Done).toBeDefined();
    }, 30_000);

    it('should mark VideoRender FAILED after exhausting all attempts', async () => {
        const renderStatusUpdates: Array<Record<string, unknown>> = [];

        const mockActivities = {
            buildTimeline: async () => ({
                timelineJson: FAKE_TIMELINE_JSON,
                totalDuration: 15,
                width: 1080,
                height: 1920,
            }),
            renderRemotion: async () => {
                throw new Error('Remotion render failed permanently');
            },
            encodeFfmpeg: async () => {
                throw new Error('should not reach encode step');
            },
            updateVideoRenderStatus: async (input: Record<string, unknown>) => {
                renderStatusUpdates.push(input);
            },
            upsertVideoRenderJob: async () => {},
            getVideoRenderJob: async () => null,
        };

        const worker = await createTestWorker(mockActivities as Record<string, (...args: unknown[]) => unknown>);
        const client = testEnv.client;

        // maxAttempts: 1 supaya test cepat (tidak perlu tunggu exponential backoff 3x)
        await expect(
            worker.runUntil(
                client.workflow.execute(renderWorkflow, {
                    workflowId: 'test-render-exhausted-001',
                    taskQueue: 'vf46-render-test-queue',
                    args: [buildRenderInput({ maxAttempts: 1 })],
                }),
            ),
        ).rejects.toThrow();

        const finalUpdate = renderStatusUpdates[renderStatusUpdates.length - 1];
        expect(finalUpdate?.['status']).toBe('FAILED');
        expect(finalUpdate?.['lastError']).toContain('Remotion render failed permanently');
    }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cancel signal
// ─────────────────────────────────────────────────────────────────────────────

describe('renderWorkflow: cancel signal', () => {
    it('should stop and mark FAILED with "Cancelled by user" when cancelled mid-flight', async () => {
        const renderStatusUpdates: Array<Record<string, unknown>> = [];

        // buildTimeline sengaja lambat supaya ada waktu mengirim signal cancel
        // sebelum workflow lanjut ke step berikutnya.
        const mockActivities = {
            buildTimeline: async () => {
                await new Promise((resolve) => setTimeout(resolve, 500));
                return {
                    timelineJson: FAKE_TIMELINE_JSON,
                    totalDuration: 15,
                    width: 1080,
                    height: 1920,
                };
            },
            renderRemotion: async () => ({ rawVideoPath: '/tmp/raw.mp4', duration: 15 }),
            encodeFfmpeg: async () => ({
                outputPath: '/tmp/out.mp4',
                fileSizeBytes: 1,
                resolution: '1080x1920',
                duration: 15,
            }),
            updateVideoRenderStatus: async (input: Record<string, unknown>) => {
                renderStatusUpdates.push(input);
            },
            upsertVideoRenderJob: async () => {},
            getVideoRenderJob: async () => null,
        };

        const worker = await createTestWorker(mockActivities as Record<string, (...args: unknown[]) => unknown>);
        const client = testEnv.client;

        const handle = await client.workflow.start(renderWorkflow, {
            workflowId: 'test-render-cancel-001',
            taskQueue: 'vf46-render-test-queue',
            // maxAttempts: 1 supaya workflow tidak retry setelah cancel
            args: [buildRenderInput({ maxAttempts: 1 })],
        });

        await worker.runUntil(async () => {
            await handle.signal(cancelRenderSignal);
            await expect(handle.result()).rejects.toThrow();
        });

        const cancelUpdate = renderStatusUpdates.find(
            (u) => u['lastError'] === 'Cancelled by user',
        );
        expect(cancelUpdate).toBeDefined();
        expect(cancelUpdate?.['status']).toBe('FAILED');
    }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Query getRenderStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('renderWorkflow: getRenderStatus query', () => {
    it('should report status BUILDING_TIMELINE while workflow is running', async () => {
        // buildTimeline sengaja lambat supaya ada waktu untuk query
        // sebelum workflow selesai (sama pola dengan vf35 query test).
        let resolveBuild!: () => void;
        const buildFinished = new Promise<void>((resolve) => {
            resolveBuild = resolve;
        });

        const mockActivities = {
            buildTimeline: async () => {
                await buildFinished;
                return {
                    timelineJson: FAKE_TIMELINE_JSON,
                    totalDuration: 15,
                    width: 1080,
                    height: 1920,
                };
            },
            renderRemotion: async () => ({ rawVideoPath: '/tmp/raw.mp4', duration: 15 }),
            encodeFfmpeg: async () => ({
                outputPath: '/tmp/out.mp4',
                fileSizeBytes: 1,
                resolution: '1080x1920',
                duration: 15,
            }),
            updateVideoRenderStatus: async () => {},
            upsertVideoRenderJob: async () => {},
            getVideoRenderJob: async () => null,
        };

        const worker = await createTestWorker(mockActivities as Record<string, (...args: unknown[]) => unknown>);
        const client = testEnv.client;

        // Start workflow (tidak await — biarkan running di background)
        const handle = await client.workflow.start(renderWorkflow, {
            workflowId: 'test-render-query-001',
            taskQueue: 'vf46-render-test-queue',
            args: [buildRenderInput()],
        });

        // Worker harus running supaya workflow task diproses dan query handler
        // ter-register. Semua operasi (wait, query, resolve, await result)
        // dilakukan di dalam worker.runUntil() supaya worker tetap running.
        await worker.runUntil(async () => {
            // Beri waktu workflow untuk start dan register query handler
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Act — query status via getRenderStatus query
            const status = await handle.query(getRenderStatus);

            // Assert — harus BUILDING_TIMELINE (workflow masih running)
            expect(status.status).toBe('BUILDING_TIMELINE');
            expect(status.attemptNumber).toBe(1);

            // Cleanup — resolve buildTimeline agar workflow bisa selesai
            resolveBuild();
            await handle.result();
        });
    }, 30_000);
});