/**
 * Suro-Buya Video Worker — VF-4.6/VF-4.7 Render Activities Unit Tests
 *
 * Test suite untuk activities/render-activities.ts:
 * 1. buildTimelineActivity — assemble VideoTimeline dari MediaAsset (termasuk
 *    ekstraksi subtype/metadata untuk VOICEOVER/SFX/BGM — lihat catatan audit
 *    soal bug subtype yang sudah diperbaiki di VF-4.6 schema update)
 * 2. renderRemotionActivity — parse timeline, tulis output file
 * 3. encodeFfmpegActivity — cek FFmpeg availability, encode per platform
 * 4. updateVideoRenderStatusActivity — partial update VideoRender
 * 5. upsertVideoRenderJobActivity — create/update VideoRenderJob
 * 6. getVideoRenderJobActivity — resume lookup
 *
 * Mengikuti pola mocking dari vf35-unit.test.ts: SATU vi.mock() per module
 * path di module scope, dengan vi.fn() yang di-declare di luar factory
 * supaya bisa di-reset/override per test tanpa registrasi mock ganda.
 *
 * CATATAN: Test Temporal workflow penuh (renderWorkflow via TestWorkflowEnvironment)
 * ada di tests/vf46-render-workflow.test.ts — file ini fokus unit test per activity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — SATU registrasi per module path (lihat catatan di vf35-unit.test.ts
// soal hoisting vi.mock: registrasi kedua untuk path yang sama akan diam-diam
// menggantikan yang pertama untuk SELURUH file, bukan cuma describe block-nya).
// ─────────────────────────────────────────────────────────────────────────────

const mockVideoProjectFindUnique = vi.fn();
const mockVideoRenderUpdate = vi.fn();
const mockVideoRenderJobFindFirst = vi.fn();
const mockVideoRenderJobCreate = vi.fn();
const mockVideoRenderJobUpdate = vi.fn();

vi.mock('../src/lib/db.js', () => ({
    prisma: {
        videoProject: {
            findUnique: mockVideoProjectFindUnique,
        },
        videoRender: {
            update: mockVideoRenderUpdate,
        },
        videoRenderJob: {
            findFirst: mockVideoRenderJobFindFirst,
            create: mockVideoRenderJobCreate,
            update: mockVideoRenderJobUpdate,
        },
    },
}));

const mockIsFFmpegAvailable = vi.fn();
const mockEncodeVideo = vi.fn();

vi.mock('@suro-buya/video-renderer', () => ({
    isFFmpegAvailable: mockIsFFmpegAvailable,
    encodeVideo: mockEncodeVideo,
}));

beforeEach(() => {
    mockVideoProjectFindUnique.mockReset();
    mockVideoRenderUpdate.mockReset().mockResolvedValue({});
    mockVideoRenderJobFindFirst.mockReset();
    mockVideoRenderJobCreate.mockReset().mockResolvedValue({});
    mockVideoRenderJobUpdate.mockReset().mockResolvedValue({});
    mockIsFFmpegAvailable.mockReset();
    mockEncodeVideo.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: bangun VideoProject + MediaAsset fixture yang valid untuk
// buildTimelineActivity. Meliputi VIDEO_CLIP + AUDIO (VOICEOVER/SFX/BGM)
// dengan subtype & metadata — ini persis field yang dulu HILANG dari schema
// (lihat audit sebelumnya) dan sekarang perlu diverifikasi benar-benar
// terbaca oleh buildTimelineActivity.
// ─────────────────────────────────────────────────────────────────────────────

function buildProjectFixture(overrides: { mediaAssets?: unknown[] } = {}) {
    const storyboard = [
        {
            index: 0,
            visualPrompt: 'Wide shot character walking',
            cameraAngle: 'wide-shot',
            duration: 4,
            dialogue: { characterId: 'char-suro', line: 'Halo dunia!' },
        },
        {
            index: 1,
            visualPrompt: 'Close-up character smiles',
            cameraAngle: 'close-up',
            duration: 3,
        },
    ];

    const defaultMediaAssets = [
        {
            id: 'ma-clip-0',
            shotIndex: 0,
            type: 'VIDEO_CLIP',
            subtype: null,
            status: 'DONE',
            resultUrl: 'https://storage.example.com/clip-0.mp4',
            providerUsed: 'kling-3.0',
            metadata: null,
        },
        {
            id: 'ma-clip-1',
            shotIndex: 1,
            type: 'VIDEO_CLIP',
            subtype: null,
            status: 'DONE',
            resultUrl: 'https://storage.example.com/clip-1.mp4',
            providerUsed: 'kling-3.0',
            metadata: null,
        },
        {
            id: 'ma-voice-0',
            shotIndex: 0,
            type: 'AUDIO',
            subtype: 'VOICEOVER',
            status: 'DONE',
            resultUrl: 'https://storage.example.com/voice-0.mp3',
            providerUsed: 'elevenlabs',
            metadata: {
                characterId: 'char-suro',
                dialogueText: 'Halo dunia!',
                voiceId: 'voice-suro-01',
            },
        },
        {
            id: 'ma-sfx-0',
            shotIndex: 0,
            type: 'AUDIO',
            subtype: 'SFX',
            status: 'DONE',
            resultUrl: 'https://storage.example.com/sfx-splash.mp3',
            providerUsed: 'library',
            metadata: { sfxType: 'splash', duration: 1.2 },
        },
        {
            id: 'ma-bgm',
            shotIndex: 0,
            type: 'AUDIO',
            subtype: 'BGM',
            status: 'DONE',
            resultUrl: 'https://storage.example.com/bgm-cheerful.mp3',
            providerUsed: 'library',
            metadata: { mood: 'cheerful', duration: 30 },
        },
        // Sengaja disisipkan asset yang BELUM selesai — harus DIABAIKAN oleh filter.
        {
            id: 'ma-clip-pending',
            shotIndex: 2,
            type: 'VIDEO_CLIP',
            subtype: null,
            status: 'GENERATING',
            resultUrl: null,
            providerUsed: null,
            metadata: null,
        },
    ];

    return {
        id: 'project-1',
        storyboard,
        character: {
            characterAsset: {
                referenceImages: ['https://storage.example.com/char-ref.jpg'],
            },
        },
        mediaAssets: overrides.mediaAssets ?? defaultMediaAssets,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. buildTimelineActivity
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/render-activities: buildTimelineActivity()', () => {
    it('should throw non-retryable ApplicationFailure when project not found', async () => {
        mockVideoProjectFindUnique.mockResolvedValueOnce(null);

        const { buildTimelineActivity } = await import('../src/activities/render-activities.js');

        await expect(
            buildTimelineActivity({ projectId: 'missing-project', platforms: ['TIKTOK'] }),
        ).rejects.toThrow(/VideoProject not found/);
    });

    it('should build timeline with only DONE assets — pending/missing-url assets excluded', async () => {
        mockVideoProjectFindUnique.mockResolvedValueOnce(buildProjectFixture());

        const { buildTimelineActivity } = await import('../src/activities/render-activities.js');

        const result = await buildTimelineActivity({
            projectId: 'project-1',
            platforms: ['TIKTOK'],
        });

        expect(result.timelineJson).toBeDefined();
        expect(result.totalDuration).toBeGreaterThan(0);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);

        const timeline = JSON.parse(result.timelineJson);

        // Hanya 2 video clip (shot 0 & 1) yang DONE — shot 2 (GENERATING) harus diabaikan
        expect(timeline.videoTrack).toHaveLength(2);
        expect(timeline.videoTrack.map((v: { shotIndex: number }) => v.shotIndex)).toEqual([0, 1]);
    });

    it('should correctly extract VOICEOVER metadata (characterId, dialogueText, voiceId)', async () => {
        mockVideoProjectFindUnique.mockResolvedValueOnce(buildProjectFixture());

        const { buildTimelineActivity } = await import('../src/activities/render-activities.js');
        const result = await buildTimelineActivity({ projectId: 'project-1', platforms: ['TIKTOK'] });
        const timeline = JSON.parse(result.timelineJson);

        // Voiceover HARUS ketemu via subtype === 'VOICEOVER' di audioTrack — ini
        // titik yang dulu SELALU kosong sebelum MediaAsset.subtype ada di schema
        // (lihat temuan audit sebelumnya: filter subtype selalu return array kosong).
        const voiceoverEntries = timeline.audioTrack.filter(
            (a: { type: string }) => a.type === 'voiceover',
        );
        expect(voiceoverEntries).toHaveLength(1);
        expect(voiceoverEntries[0]).toMatchObject({
            shotIndex: 0,
            audioUrl: 'https://storage.example.com/voice-0.mp3',
        });
    });

    it('should correctly extract SFX metadata (sfxType, duration) grouped per shot', async () => {
        mockVideoProjectFindUnique.mockResolvedValueOnce(buildProjectFixture());

        const { buildTimelineActivity } = await import('../src/activities/render-activities.js');
        const result = await buildTimelineActivity({ projectId: 'project-1', platforms: ['TIKTOK'] });
        const timeline = JSON.parse(result.timelineJson);

        const sfxEntries = timeline.audioTrack.filter((a: { type: string }) => a.type === 'sfx');
        expect(sfxEntries).toHaveLength(1);
        expect(sfxEntries[0]).toMatchObject({
            shotIndex: 0,
            audioUrl: 'https://storage.example.com/sfx-splash.mp3',
            duration: 1.2,
        });
    });

    it('should correctly extract BGM metadata (mood, url) when BGM asset present', async () => {
        mockVideoProjectFindUnique.mockResolvedValueOnce(buildProjectFixture());

        const { buildTimelineActivity } = await import('../src/activities/render-activities.js');
        const result = await buildTimelineActivity({ projectId: 'project-1', platforms: ['TIKTOK'] });
        const timeline = JSON.parse(result.timelineJson);

        const musicEntries = timeline.audioTrack.filter((a: { type: string }) => a.type === 'music');
        expect(musicEntries).toHaveLength(1);
        expect(musicEntries[0].audioUrl).toBe('https://storage.example.com/bgm-cheerful.mp3');
    });

    it('should produce no music audioTrack entry (not throw) when no BGM asset exists', async () => {
        const fixture = buildProjectFixture();
        fixture.mediaAssets = fixture.mediaAssets.filter(
            (a) => (a as { subtype?: string }).subtype !== 'BGM',
        );
        mockVideoProjectFindUnique.mockResolvedValueOnce(fixture);

        const { buildTimelineActivity } = await import('../src/activities/render-activities.js');
        const result = await buildTimelineActivity({ projectId: 'project-1', platforms: ['TIKTOK'] });
        const timeline = JSON.parse(result.timelineJson);

        const musicEntries = timeline.audioTrack.filter((a: { type: string }) => a.type === 'music');
        expect(musicEntries).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. renderRemotionActivity
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/render-activities: renderRemotionActivity()', () => {
    it('should write output file and return rawVideoPath + duration from timeline', async () => {
        const { renderRemotionActivity } = await import('../src/activities/render-activities.js');

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vf46-remotion-'));
        const outputPath = path.join(tmpDir, 'nested', 'raw.mp4');

        const timelineJson = JSON.stringify({ totalDuration: 12.5, video: [], audio: {} });

        const result = await renderRemotionActivity({ timelineJson, outputPath });

        expect(result.rawVideoPath).toBe(outputPath);
        expect(result.duration).toBe(12.5);

        // Output directory (termasuk yang belum ada) harus dibuat otomatis
        const stat = await fs.stat(outputPath);
        expect(stat.isFile()).toBe(true);

        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. encodeFfmpegActivity
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/render-activities: encodeFfmpegActivity()', () => {
    it('should throw retryable ApplicationFailure when FFmpeg not available', async () => {
        mockIsFFmpegAvailable.mockResolvedValueOnce(false);

        const { encodeFfmpegActivity } = await import('../src/activities/render-activities.js');

        await expect(
            encodeFfmpegActivity({
                rawVideoPath: '/tmp/raw.mp4',
                platform: 'TIKTOK',
                outputPath: '/tmp/out.mp4',
                width: 1080,
                height: 1920,
            }),
        ).rejects.toThrow(/FFmpeg not available/);

        expect(mockEncodeVideo).not.toHaveBeenCalled();
    });

    it('should encode video via FFmpeg when available and return result', async () => {
        mockIsFFmpegAvailable.mockResolvedValueOnce(true);
        mockEncodeVideo.mockResolvedValueOnce({
            outputPath: '/tmp/out-tiktok.mp4',
            fileSizeBytes: 4_200_000,
            resolution: '1080x1920',
            duration: 15,
        });

        const { encodeFfmpegActivity } = await import('../src/activities/render-activities.js');

        const result = await encodeFfmpegActivity({
            rawVideoPath: '/tmp/raw.mp4',
            platform: 'TIKTOK',
            outputPath: '/tmp/out-tiktok.mp4',
            width: 1080,
            height: 1920,
        });

        expect(result.outputPath).toBe('/tmp/out-tiktok.mp4');
        expect(result.fileSizeBytes).toBe(4_200_000);
        expect(result.resolution).toBe('1080x1920');
        expect(mockEncodeVideo).toHaveBeenCalledTimes(1);
        // Preset yang dikirim ke encodeVideo harus preset TikTok (arg pertama)
        expect(mockEncodeVideo.mock.calls[0][1]).toBe('/tmp/raw.mp4');
        expect(mockEncodeVideo.mock.calls[0][2]).toBe('/tmp/out-tiktok.mp4');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. updateVideoRenderStatusActivity
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/render-activities: updateVideoRenderStatusActivity()', () => {
    it('should only include defined fields in update data (partial update)', async () => {
        const { updateVideoRenderStatusActivity } = await import(
            '../src/activities/render-activities.js'
        );

        await updateVideoRenderStatusActivity({
            videoRenderId: 'render-1',
            status: 'RENDERING',
            // videoUrl, thumbnailUrl, fileSizeBytes, lastError sengaja tidak diisi
        });

        expect(mockVideoRenderUpdate).toHaveBeenCalledWith({
            where: { id: 'render-1' },
            data: { status: 'RENDERING' },
        });
    });

    it('should include videoUrl/thumbnailUrl/fileSizeBytes when status DONE', async () => {
        const { updateVideoRenderStatusActivity } = await import(
            '../src/activities/render-activities.js'
        );

        await updateVideoRenderStatusActivity({
            videoRenderId: 'render-1',
            status: 'DONE',
            videoUrl: 'file:///tmp/out.mp4',
            thumbnailUrl: 'file:///tmp/thumb.jpg',
            fileSizeBytes: 1234,
        });

        expect(mockVideoRenderUpdate).toHaveBeenCalledWith({
            where: { id: 'render-1' },
            data: {
                status: 'DONE',
                videoUrl: 'file:///tmp/out.mp4',
                thumbnailUrl: 'file:///tmp/thumb.jpg',
                fileSizeBytes: 1234,
            },
        });
    });

    it('should include lastError when status FAILED', async () => {
        const { updateVideoRenderStatusActivity } = await import(
            '../src/activities/render-activities.js'
        );

        await updateVideoRenderStatusActivity({
            videoRenderId: 'render-1',
            status: 'FAILED',
            lastError: 'FFmpeg not available',
        });

        expect(mockVideoRenderUpdate).toHaveBeenCalledWith({
            where: { id: 'render-1' },
            data: { status: 'FAILED', lastError: 'FFmpeg not available' },
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. upsertVideoRenderJobActivity
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/render-activities: upsertVideoRenderJobActivity()', () => {
    it('should create a new VideoRenderJob when none exists for this attempt', async () => {
        mockVideoRenderJobFindFirst.mockResolvedValueOnce(null);

        const { upsertVideoRenderJobActivity } = await import(
            '../src/activities/render-activities.js'
        );

        await upsertVideoRenderJobActivity({
            videoRenderId: 'render-1',
            attemptNumber: 1,
            providerUsed: 'remotion+ffmpeg',
            status: 'RENDERING',
        });

        expect(mockVideoRenderJobFindFirst).toHaveBeenCalledWith({
            where: { renderId: 'render-1', attemptNumber: 1 },
        });
        expect(mockVideoRenderJobCreate).toHaveBeenCalledTimes(1);
        expect(mockVideoRenderJobUpdate).not.toHaveBeenCalled();
        expect(mockVideoRenderJobCreate.mock.calls[0][0].data).toMatchObject({
            renderId: 'render-1',
            attemptNumber: 1,
            providerUsed: 'remotion+ffmpeg',
            status: 'RENDERING',
        });
    });

    it('should update the existing VideoRenderJob when one already exists for this attempt', async () => {
        mockVideoRenderJobFindFirst.mockResolvedValueOnce({ id: 'job-abc' });

        const { upsertVideoRenderJobActivity } = await import(
            '../src/activities/render-activities.js'
        );

        await upsertVideoRenderJobActivity({
            videoRenderId: 'render-1',
            attemptNumber: 1,
            providerUsed: 'remotion+ffmpeg',
            status: 'DONE',
            cost: 0,
        });

        expect(mockVideoRenderJobUpdate).toHaveBeenCalledTimes(1);
        expect(mockVideoRenderJobCreate).not.toHaveBeenCalled();
        expect(mockVideoRenderJobUpdate.mock.calls[0][0].where).toEqual({ id: 'job-abc' });
        expect(mockVideoRenderJobUpdate.mock.calls[0][0].data).toMatchObject({
            status: 'DONE',
            cost: 0,
        });
    });

    // Idempotency: dua kali panggil dengan attemptNumber sama (simulasi Temporal
    // re-execute activity setelah crash) TIDAK boleh membuat 2 row berbeda —
    // pola yang sama seperti idempotency guard di VF-3.5 (checkAlreadyDone).
    it('should be idempotent — second call for the same attempt updates, not duplicates', async () => {
        const { upsertVideoRenderJobActivity } = await import(
            '../src/activities/render-activities.js'
        );

        mockVideoRenderJobFindFirst.mockResolvedValueOnce(null);
        await upsertVideoRenderJobActivity({
            videoRenderId: 'render-1',
            attemptNumber: 1,
            providerUsed: 'remotion+ffmpeg',
            status: 'RENDERING',
        });

        mockVideoRenderJobFindFirst.mockResolvedValueOnce({ id: 'job-abc' });
        await upsertVideoRenderJobActivity({
            videoRenderId: 'render-1',
            attemptNumber: 1,
            providerUsed: 'remotion+ffmpeg',
            status: 'DONE',
        });

        expect(mockVideoRenderJobCreate).toHaveBeenCalledTimes(1);
        expect(mockVideoRenderJobUpdate).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. getVideoRenderJobActivity
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/render-activities: getVideoRenderJobActivity()', () => {
    it('should return null when no matching VideoRenderJob found', async () => {
        mockVideoRenderJobFindFirst.mockResolvedValueOnce(null);

        const { getVideoRenderJobActivity } = await import(
            '../src/activities/render-activities.js'
        );

        const result = await getVideoRenderJobActivity({
            videoRenderId: 'render-missing',
            attemptNumber: 1,
        });

        expect(result).toBeNull();
    });

    it('should map DB record to VideoRenderJobRecord when found', async () => {
        const startedAt = new Date('2026-08-01T10:00:00Z');
        const completedAt = new Date('2026-08-01T10:05:00Z');

        mockVideoRenderJobFindFirst.mockResolvedValueOnce({
            id: 'job-1',
            renderId: 'render-1',
            attemptNumber: 1,
            providerUsed: 'remotion+ffmpeg',
            status: 'DONE',
            startedAt,
            completedAt,
            error: null,
            cost: 0,
            metadata: { platforms: [] },
        });

        const { getVideoRenderJobActivity } = await import(
            '../src/activities/render-activities.js'
        );

        const result = await getVideoRenderJobActivity({
            videoRenderId: 'render-1',
            attemptNumber: 1,
        });

        expect(result).toMatchObject({
            id: 'job-1',
            videoRenderId: 'render-1', // dipetakan dari field DB 'renderId'
            attemptNumber: 1,
            status: 'DONE',
            startedAt,
            completedAt,
        });
    });
});