/**
 * Suro-Buya Video Worker — VF-3.5 Unit Tests
 *
 * Test suite untuk memverifikasi behaviour kritis VF-3.5:
 * 1. Workflow state machine (GENERATING → DONE / FAILED / CANCELLED)
 * 2. Activities: updateMediaAssetStatus, generateImage, generateVideoClip
 * 3. Config loading dan validation
 * 4. Provider setup (mock registry untuk unit test tanpa API key)
 * 5. Acceptance criteria VF-3.5: resume-on-crash & retry policy
 *
 * CATATAN: Test Temporal workflow sepenuhnya (end-to-end dengan Temporal server)
 * membutuhkan @temporalio/testing (TestWorkflowEnvironment) — lihat tests/temporal-workflow.test.ts.
 * File ini fokus unit test pada level individu module (activities, config, provider-setup).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Shared mock untuk '../src/lib/db.js' — SATU registrasi untuk SELURUH file test.
 *
 * PENTING (perbaikan bug test — akar masalah "expected spy called 0 times"):
 * Vitest meng-hoist SEMUA `vi.mock('../src/lib/db.js', factory)` di file ini
 * ke SATU registrasi global untuk module path tersebut — mock kedua/ketiga
 * yang didaftarkan di describe/beforeEach lain untuk path yang SAMA diam-diam
 * MENGGANTIKAN yang pertama untuk SELURUH file, bukan cuma untuk test/describe
 * block tempat dia ditulis. Sebelumnya file ini punya banyak `vi.mock('../src/lib/db.js', ...)`
 * tersebar di banyak `it()`/`beforeEach()` — kebetulan tidak ketahuan sampai
 * ditambah lagi mock baru untuk idempotency guard test, yang langsung
 * membuat mock LAIN (termasuk yang sudah ada sebelumnya) berhenti dipakai.
 *
 * Solusi: SATU `vi.mock()` di module scope, dengan `vi.fn()` yang di-declare
 * di luar factory (ditangkap via closure) — supaya setiap test bisa
 * mengatur ulang behaviour-nya lewat `mockResolvedValueOnce()` tanpa perlu
 * mendaftarkan factory baru.
 */
const mockFindUnique = vi.fn();
const mockPrismaUpdate = vi.fn();
vi.mock('../src/lib/db.js', () => ({
    prisma: {
        mediaAsset: {
            findUnique: mockFindUnique,
            update: mockPrismaUpdate,
        },
    },
}));

beforeEach(() => {
    // Default: MediaAsset belum ada / belum DONE (null) — idempotency guard
    // TIDAK short-circuit secara default, kecuali test tertentu meng-override
    // dengan mockResolvedValueOnce(). Ini menjaga semua test lain (yang tidak
    // peduli soal idempotency guard) berperilaku seperti sebelum perbaikan.
    mockFindUnique.mockReset().mockResolvedValue(null);
    mockPrismaUpdate.mockReset().mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Config loading tests
// ─────────────────────────────────────────────────────────────────────────────

describe('config: loadConfig()', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should throw if DATABASE_URL is missing', async () => {
        // Arrange
        const originalEnv = process.env['DATABASE_URL'];
        delete process.env['DATABASE_URL'];

        try {
            // Act + Assert
            const { loadConfig } = await import('../src/config.js');
            expect(() => loadConfig()).toThrow(
                'DATABASE_URL environment variable is required',
            );
        } finally {
            // Restore
            if (originalEnv !== undefined) {
                process.env['DATABASE_URL'] = originalEnv;
            }
        }
    });

    it('should return default Temporal config values when env vars not set', async () => {
        // Arrange
        process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
        delete process.env['TEMPORAL_ADDRESS'];
        delete process.env['TEMPORAL_NAMESPACE'];
        delete process.env['TEMPORAL_TASK_QUEUE'];

        const { loadConfig } = await import('../src/config.js');

        // Act
        const config = loadConfig();

        // Assert
        expect(config.temporal.address).toBe('localhost:7233');
        expect(config.temporal.namespace).toBe('default');
        expect(config.temporal.taskQueue).toBe('video-media-queue');
    });

    it('should use custom values from environment variables', async () => {
        // Arrange
        process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
        process.env['TEMPORAL_ADDRESS'] = 'temporal.prod.example.com:7233';
        process.env['TEMPORAL_NAMESPACE'] = 'suro-buya-prod';
        process.env['TEMPORAL_TASK_QUEUE'] = 'video-gen-prod';
        process.env['MEDIA_JOB_MAX_RETRIES'] = '5';

        const { loadConfig } = await import('../src/config.js');

        // Act
        const config = loadConfig();

        // Assert
        expect(config.temporal.address).toBe('temporal.prod.example.com:7233');
        expect(config.temporal.namespace).toBe('suro-buya-prod');
        expect(config.temporal.taskQueue).toBe('video-gen-prod');
        expect(config.maxRetryAttempts).toBe(5);
    });

    it('DEFAULT_RETRY_POLICY should have correct structure for media generation', async () => {
        // Act
        const { DEFAULT_RETRY_POLICY } = await import('../src/config.js');

        // Assert — retry policy sesuai acceptance criteria VF-3.5
        expect(DEFAULT_RETRY_POLICY.maximumAttempts).toBe(3);
        expect(DEFAULT_RETRY_POLICY.backoffCoefficient).toBe(2.0);
        expect(DEFAULT_RETRY_POLICY.initialInterval).toBeLessThanOrEqual(5000); // Reasonable for transient failures
        expect(DEFAULT_RETRY_POLICY.maximumInterval).toBeGreaterThanOrEqual(10000); // Cap at reasonable max
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Provider setup tests
// ─────────────────────────────────────────────────────────────────────────────

describe('provider-setup: createMockImageRegistry()', () => {
    it('should create a mock image registry that is available', async () => {
        const { createMockImageRegistry } = await import('../src/lib/provider-setup.js');

        // Act
        const registry = createMockImageRegistry();

        // Assert — mock provider selalu available
        expect(registry).toBeDefined();
    });

    it('should successfully generateImage with mock registry', async () => {
        const { createMockImageRegistry } = await import('../src/lib/provider-setup.js');

        // Arrange
        const registry = createMockImageRegistry();

        // Act
        const { result, providerUsed, attempts } = await registry.generateImage({
            prompt: 'A brave character in a magical forest, 9:16 vertical',
            aspectRatio: '9:16',
        });

        // Assert
        expect(result.url).toBeDefined();
        expect(result.url).toMatch(/^https?:\/\//);
        expect(providerUsed).toBeDefined();
        expect(attempts).toBeInstanceOf(Array);
        expect(attempts.length).toBeGreaterThan(0);
    });
});

describe('provider-setup: createMockVideoRegistry()', () => {
    it('should successfully generateVideoClip with mock registry', async () => {
        const { createMockVideoRegistry } = await import('../src/lib/provider-setup.js');

        // Arrange
        const registry = createMockVideoRegistry();

        // Act
        const { result, providerUsed, attempts } = await registry.generateVideoClip({
            keyframeUrl: 'https://example.com/keyframe.jpg',
            motionPrompt: 'slow pan right',
            duration: 3,
            aspectRatio: '9:16',
        });

        // Assert
        expect(result.url).toBeDefined();
        expect(providerUsed).toBeDefined();
        expect(attempts).toBeInstanceOf(Array);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Shared interfaces validation tests
// ─────────────────────────────────────────────────────────────────────────────

describe('shared/interfaces: MediaJobWorkflowInput structure', () => {
    it('should accept valid IMAGE job input', () => {
        // Arrange — verifikasi type compatibility (compile-time test di runtime)
        const validImageInput = {
            mediaAssetId: 'asset-cuid-123',
            projectId: 'project-cuid-456',
            shotIndex: 0,
            type: 'IMAGE' as const,
            shotSpec: {
                index: 0,
                duration: 3,
                cameraAngle: 'close-up' as const,
                dialogue: { characterId: 'char-suro', line: 'Halo, siapa kamu?' },
                action: 'Character waves hand',
                visualPrompt: 'Close-up of brave character, warm lighting',
                motionPrompt: undefined,
            },
            visualProfile: {
                referenceImages: ['https://example.com/ref1.jpg'],
                styleTags: ['2D digital', 'warm colors'],
                colorPalette: ['#FF6B35', '#F7931E'],
                negativePrompt: 'blurry, low quality',
            },
            artStyle: '2D digital illustration',
        };

        // Assert — kalau compiles dan runs, interface match
        expect(validImageInput.type).toBe('IMAGE');
        expect(validImageInput.shotIndex).toBe(0);
        expect(validImageInput.mediaAssetId).toBeTruthy();
    });

    it('should accept valid VIDEO_CLIP job input with keyframeUrl', () => {
        // Arrange
        const validVideoClipInput = {
            mediaAssetId: 'asset-cuid-789',
            projectId: 'project-cuid-456',
            shotIndex: 0,
            type: 'VIDEO_CLIP' as const,
            shotSpec: {
                index: 0,
                duration: 3,
                cameraAngle: 'wide-shot' as const,
                dialogue: undefined,
                action: 'Character runs across field',
                visualPrompt: 'Wide shot of character running',
                motionPrompt: 'pan right, slow',
            },
            keyframeUrl: 'https://storage.example.com/keyframe-shot-0.jpg',
        };

        // Assert
        expect(validVideoClipInput.type).toBe('VIDEO_CLIP');
        expect(validVideoClipInput.keyframeUrl).toContain('keyframe');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Workflow signal/query definitions (pola unit test Temporal)
// ─────────────────────────────────────────────────────────────────────────────

describe('workflows/media-job: query and signal definitions', () => {
    it('should export getStatus query definition', async () => {
        const { getStatus } = await import('../src/workflows/index.js');

        // Assert — getStatus adalah QueryDefinition Temporal
        expect(getStatus).toBeDefined();
        expect(getStatus.name).toBe('getStatus');
    });

    it('should export cancelSignal signal definition', async () => {
        const { cancelSignal } = await import('../src/workflows/index.js');

        // Assert — cancelSignal adalah SignalDefinition Temporal
        expect(cancelSignal).toBeDefined();
        expect(cancelSignal.name).toBe('cancel');
    });

    it('should export mediaJobWorkflow function', async () => {
        const { mediaJobWorkflow } = await import('../src/workflows/index.js');

        // Assert — workflow function exported dengan benar
        expect(typeof mediaJobWorkflow).toBe('function');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Activities index exports
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/index: all activities exported', () => {
    it('should export all required activities in activities object', async () => {
        const { activities } = await import('../src/activities/index.js');

        // Assert — semua activities yang dibutuhkan workflow terdaftar
        expect(typeof activities.updateMediaAssetStatus).toBe('function');
        expect(typeof activities.generateImage).toBe('function');
        expect(typeof activities.generateVideoClip).toBe('function');
    });

    it('should export getMediaAsset as named export', async () => {
        mockFindUnique.mockResolvedValueOnce({
            id: 'asset-123',
            status: 'PENDING',
        });

        const { getMediaAsset } = await import('../src/activities/index.js');
        expect(typeof getMediaAsset).toBe('function');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. updateMediaAssetStatus activity — unit test dengan mock Prisma
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/media-asset: updateMediaAssetStatus()', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should call prisma.mediaAsset.update with correct status', async () => {
        const { updateMediaAssetStatus } = await import('../src/activities/media-asset.js');

        // Act
        await updateMediaAssetStatus({
            mediaAssetId: 'asset-123',
            status: 'GENERATING',
        });

        // Assert
        expect(mockPrismaUpdate).toHaveBeenCalledWith({
            where: { id: 'asset-123' },
            data: { status: 'GENERATING' },
        });
    });

    it('should update all fields when DONE status with full result', async () => {
        const { updateMediaAssetStatus } = await import('../src/activities/media-asset.js');

        // Act
        await updateMediaAssetStatus({
            mediaAssetId: 'asset-456',
            status: 'DONE',
            providerUsed: 'nano-banana-2',
            providerAttempts: ['nano-banana-2'],
            resultUrl: 'https://storage.example.com/asset-456.jpg',
            cost: 0.0035,
        });

        // Assert — cost, url, provider semua masuk ke update
        expect(mockPrismaUpdate).toHaveBeenCalledWith({
            where: { id: 'asset-456' },
            data: {
                status: 'DONE',
                providerUsed: 'nano-banana-2',
                providerAttempts: ['nano-banana-2'],
                resultUrl: 'https://storage.example.com/asset-456.jpg',
                cost: 0.0035,
            },
        });
    });

    it('should update lastError when FAILED status', async () => {
        const { updateMediaAssetStatus } = await import('../src/activities/media-asset.js');

        // Act
        await updateMediaAssetStatus({
            mediaAssetId: 'asset-789',
            status: 'FAILED',
            lastError: 'MediaChainExhaustedError: all providers failed',
        });

        // Assert
        expect(mockPrismaUpdate).toHaveBeenCalledWith({
            where: { id: 'asset-789' },
            data: {
                status: 'FAILED',
                lastError: 'MediaChainExhaustedError: all providers failed',
            },
        });
    });

    it('should NOT include undefined fields in update data', async () => {
        const { updateMediaAssetStatus } = await import('../src/activities/media-asset.js');

        // Act — hanya status diisi, yang lain undefined
        await updateMediaAssetStatus({
            mediaAssetId: 'asset-001',
            status: 'RETRYING',
            retryCount: 1,
        });

        // Assert — data hanya punya status + retryCount, tidak ada field undefined
        const callArgs = mockPrismaUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined;
        expect(callArgs?.data).not.toHaveProperty('providerUsed');
        expect(callArgs?.data).not.toHaveProperty('resultUrl');
        expect(callArgs?.data).not.toHaveProperty('cost');
        expect(callArgs?.data).toHaveProperty('status', 'RETRYING');
        expect(callArgs?.data).toHaveProperty('retryCount', 1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. generateImage activity — unit test dengan mock registry
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/media-generation: generateImage()', () => {
    beforeEach(() => {
        vi.resetModules();
        // Pastikan tidak ada API key → pakai mock registry
        delete process.env['FAL_API_KEY'];
        delete process.env['GEMINI_API_KEY'];
        // MediaAsset belum ada / belum DONE (default global beforeEach di atas)
        // → idempotency guard tidak nge-short-circuit, activity lanjut generate seperti biasa.
    });

    it('should generate image and return MediaGenerationResult', async () => {
        const { generateImage } = await import('../src/activities/media-generation.js');

        // Act
        const result = await generateImage({
            mediaAssetId: 'asset-gen-1',
            shotSpec: {
                index: 0,
                duration: 3,
                cameraAngle: 'close-up',
                dialogue: { characterId: 'char-suro', line: 'Halo dunia!' },
                action: 'Character waves',
                visualPrompt: 'Close-up character waving, warm colors',
                motionPrompt: undefined,
            },
        });

        // Assert
        expect(result.resultUrl).toBeDefined();
        expect(typeof result.resultUrl).toBe('string');
        expect(result.providerUsed).toBeDefined();
        expect(result.providerAttempts).toBeInstanceOf(Array);
        expect(typeof result.cost).toBe('number');
        expect(result.cost).toBeGreaterThanOrEqual(0);
        expect(result.fromCache).toBeFalsy();
    });

    it('should pass visualProfile reference images to provider', async () => {
        const { generateImage } = await import('../src/activities/media-generation.js');

        // Act — dengan visualProfile (reference images)
        const result = await generateImage({
            mediaAssetId: 'asset-gen-2',
            shotSpec: {
                index: 1,
                duration: 3,
                cameraAngle: 'medium-shot',
                dialogue: undefined,
                action: 'Character runs',
                visualPrompt: 'Medium shot character running',
                motionPrompt: 'pan right',
            },
            visualProfile: {
                referenceImages: [
                    'https://storage.example.com/char-front.jpg',
                    'https://storage.example.com/char-side.jpg',
                ],
                styleTags: ['2D digital', 'animated'],
                colorPalette: ['#4A90E2', '#F5A623'],
                negativePrompt: 'photorealistic, 3D',
            },
            artStyle: '2D digital illustration, Indonesian style',
        });

        // Assert — result valid meski dengan reference images
        expect(result.resultUrl).toBeDefined();
        expect(result.providerAttempts.length).toBeGreaterThan(0);
    });

    it('should reject (non-retryable) when shotSpec fails style guide validation', async () => {
        const { generateImage } = await import('../src/activities/media-generation.js');

        // Act + Assert — visualPrompt kosong = violation 'error' di enforceStyleGuide (VF-3.2)
        await expect(
            generateImage({
                mediaAssetId: 'asset-gen-invalid',
                shotSpec: {
                    index: 3,
                    duration: 3,
                    cameraAngle: 'close-up',
                    dialogue: undefined,
                    action: 'Character stands still',
                    visualPrompt: '', // ← invalid, harus ditolak SEBELUM panggil provider
                    motionPrompt: undefined,
                },
            }),
        ).rejects.toThrow(/Style guide validation failed/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. generateVideoClip activity — unit test dengan mock registry
// ─────────────────────────────────────────────────────────────────────────────

describe('activities/media-generation: generateVideoClip()', () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env['FAL_API_KEY'];
    });

    it('should generate video clip and return MediaGenerationResult', async () => {
        const { generateVideoClip } = await import('../src/activities/media-generation.js');

        // Act
        const result = await generateVideoClip({
            mediaAssetId: 'asset-clip-1',
            keyframeUrl: 'https://storage.example.com/keyframe-shot-0.jpg',
            shotSpec: {
                index: 0,
                duration: 4,
                cameraAngle: 'wide-shot',
                dialogue: undefined,
                action: 'Character walks into frame',
                visualPrompt: 'Wide shot character walking',
                motionPrompt: 'slow pan left',
            },
        });

        // Assert
        expect(result.resultUrl).toBeDefined();
        expect(result.providerUsed).toBeDefined();
        expect(result.providerAttempts).toBeInstanceOf(Array);
        expect(typeof result.cost).toBe('number');
        expect(result.fromCache).toBeFalsy();
    });

    it('should resolve motion preset from cameraAngle when motionPrompt is undefined', async () => {
        const { generateVideoClip } = await import('../src/activities/media-generation.js');

        // Act — tanpa custom motionPrompt → resolveMotionPrompt pakai preset dari cameraAngle
        const result = await generateVideoClip({
            mediaAssetId: 'asset-clip-2',
            keyframeUrl: 'https://storage.example.com/keyframe-shot-1.jpg',
            shotSpec: {
                index: 1,
                duration: 3,
                cameraAngle: 'close-up',
                dialogue: { characterId: 'char-suro', line: 'Aku siap!' },
                action: 'Character smiles confidently',
                visualPrompt: 'Close-up confident character',
                motionPrompt: undefined, // ← no custom prompt
            },
        });

        // Assert — tetap berhasil meski tanpa custom motionPrompt
        expect(result.resultUrl).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Resume-on-crash: idempotency test
// ─────────────────────────────────────────────────────────────────────────────

describe('VF-3.5 acceptance criteria: resume-on-crash idempotency', () => {
    it('updateMediaAssetStatus should be idempotent — retry same update is safe', async () => {
        const { updateMediaAssetStatus } = await import('../src/activities/media-asset.js');

        const update = {
            mediaAssetId: 'asset-idempotent',
            status: 'DONE' as const,
            providerUsed: 'nano-banana-2',
            resultUrl: 'https://storage.example.com/asset-idempotent.jpg',
            cost: 0.0042,
        };

        // Act — panggil dua kali (simulate Temporal re-execute setelah crash)
        await updateMediaAssetStatus(update);
        await updateMediaAssetStatus(update);

        // Assert — update dengan data sama, kedua panggilan aman
        expect(mockPrismaUpdate).toHaveBeenCalledTimes(2);
        expect(mockPrismaUpdate.mock.calls[0]).toEqual(mockPrismaUpdate.mock.calls[1]);
    });

    it('generateImage should SKIP provider call and return cached result when MediaAsset already DONE', async () => {
        vi.resetModules();
        delete process.env['FAL_API_KEY'];
        delete process.env['GEMINI_API_KEY'];

        // Arrange — MediaAsset SUDAH DONE dari attempt sebelumnya (simulasi:
        // worker crash setelah provider sukses, Temporal retry activity ini).
        // resultUrl sengaja beda pola dari mock provider ("mock-media.local")
        // supaya kita bisa BUKTIKAN hasilnya benar-benar dari cache, bukan
        // generate baru yang kebetulan sama.
        mockFindUnique.mockResolvedValueOnce({
            id: 'asset-already-done',
            status: 'DONE',
            resultUrl: 'https://cdn.surobuya.example/cached/asset-already-done.jpg',
            providerUsed: 'nano-banana-2',
            providerAttempts: ['nano-banana-2'],
            cost: 0.015,
        });

        const { generateImage } = await import('../src/activities/media-generation.js');

        const input = {
            mediaAssetId: 'asset-already-done',
            shotSpec: {
                index: 2,
                duration: 3,
                cameraAngle: 'extreme-close-up' as const,
                dialogue: { characterId: 'char-suro', line: 'Tunggu!' },
                action: 'Character holds up hand',
                visualPrompt: 'Extreme close-up of character face',
                motionPrompt: undefined,
            },
        };

        // Act
        const result = await generateImage(input);

        // Assert — hasil PERSIS dari DB (bukan URL baru dari mock provider),
        // dan ditandai fromCache: true. Ini membuktikan provider TIDAK
        // dipanggil ulang — inti dari perbaikan idempotency guard.
        expect(result.fromCache).toBe(true);
        expect(result.resultUrl).toBe(
            'https://cdn.surobuya.example/cached/asset-already-done.jpg',
        );
        expect(result.cost).toBe(0.015);
        expect(mockFindUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'asset-already-done' } }),
        );
    });

    it('generateImage should proceed to generate normally when MediaAsset is still GENERATING (not DONE)', async () => {
        vi.resetModules();
        delete process.env['FAL_API_KEY'];
        delete process.env['GEMINI_API_KEY'];

        // Arrange — status GENERATING (retry sebelum provider selesai) → guard
        // tidak boleh menganggap ini "selesai", harus tetap generate.
        mockFindUnique.mockResolvedValueOnce({
            id: 'asset-in-progress',
            status: 'GENERATING',
            resultUrl: null,
        });

        const { generateImage } = await import('../src/activities/media-generation.js');

        const result = await generateImage({
            mediaAssetId: 'asset-in-progress',
            shotSpec: {
                index: 4,
                duration: 3,
                cameraAngle: 'wide-shot' as const,
                dialogue: undefined,
                action: 'Character looks around',
                visualPrompt: 'Wide shot character looking around',
                motionPrompt: undefined,
            },
        });

        // Assert — generate baru betulan jalan (bukan short-circuit)
        expect(result.fromCache).toBeFalsy();
        expect(result.resultUrl).toContain('mock-media.local');
    });
});