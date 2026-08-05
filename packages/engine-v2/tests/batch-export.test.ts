/**
 * VF-5.6 — Batch Orchestrator + Export Manager tests
 *
 * Test suite untuk batch-orchestrator.ts dan export-manager.ts.
 * Menguji:
 * - Batch orchestrator: sequential, parallel, skip, cancel, retry
 * - Export manager: keyword extraction, hashtag generation, caption generation, multi-platform
 */

import { describe, it, expect, vi } from 'vitest';
import {
  orchestrateBatchExport,
  retryFailedBatchItems,
  createCancelToken,
  BatchOrchestratorError,
  type BatchOrchestratorInput,
  type ExportProjectCallback,
  type ExportProjectResult,
} from '../src/batch/batch-orchestrator.js';
import {
  generateExportMetadata,
  extractKeywordsFromScript,
  generateHashtags,
  getPlatformMetadataLimit,
  validateExportMetadata,
  type ExportMetadataInput,
} from '../src/batch/export-manager.js';

// ============================================================
// Mock export callback
// ============================================================

function createMockExportCallback(
  results: Map<string, ExportProjectResult>,
  shouldFail: Set<string> = new Set(),
): ExportProjectCallback {
  return async (projectId: string) => {
    if (shouldFail.has(projectId)) {
      throw new Error(`Export failed for project ${projectId}`);
    }
    const result = results.get(projectId);
    if (!result) {
      throw new Error(`No mock result for project ${projectId}`);
    }
    return result;
  };
}

// ============================================================
// Batch Orchestrator Tests
// ============================================================

describe('VF-5.6: batch-orchestrator', () => {
  describe('orchestrateBatchExport()', () => {
    it('should throw BatchOrchestratorError for empty items', async () => {
      await expect(
        orchestrateBatchExport({ items: [] }, createMockExportCallback(new Map())),
      ).rejects.toThrow(BatchOrchestratorError);
    });

    it('should export all items sequentially (default mode)', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
        ['p2', { videoUrl: 'https://example.com/v2.mp4', cost: 0.3, duration: 30 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p2', title: 'Project 2', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      const result = await orchestrateBatchExport(input, createMockExportCallback(results));

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.totalCost).toBe(0.8);
      expect(result.totalDuration).toBe(45);
      expect(result.wasCancelled).toBe(false);
      expect(result.items[0].status).toBe('DONE');
      expect(result.items[0].videoUrl).toBe('https://example.com/v1.mp4');
      expect(result.items[1].status).toBe('DONE');
    });

    it('should export items in parallel mode', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
        ['p2', { videoUrl: 'https://example.com/v2.mp4', cost: 0.3, duration: 30 }],
        ['p3', { videoUrl: 'https://example.com/v3.mp4', cost: 0.2, duration: 20 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p2', title: 'Project 2', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p3', title: 'Project 3', platforms: ['TIKTOK'], isReviewed: true },
        ],
        mode: 'parallel',
        maxConcurrency: 2,
      };

      const result = await orchestrateBatchExport(input, createMockExportCallback(results));

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.totalCost).toBe(1.0);
    });

    it('should skip projects that are not reviewed', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p2', title: 'Project 2', platforms: ['TIKTOK'], isReviewed: false },
        ],
      };

      const result = await orchestrateBatchExport(input, createMockExportCallback(results));

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.items[0].status).toBe('DONE');
      expect(result.items[1].status).toBe('SKIPPED');
      expect(result.warnings).toContain(
        'Project "Project 2" (p2) skipped — not yet REVIEWED.',
      );
    });

    it('should handle failed exports', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
        ['p2', { videoUrl: 'https://example.com/v2.mp4', cost: 0.3, duration: 30 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p2', title: 'Project 2', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      const result = await orchestrateBatchExport(
        input,
        createMockExportCallback(results, new Set(['p2'])),
      );

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.items[0].status).toBe('DONE');
      expect(result.items[1].status).toBe('FAILED');
      expect(result.items[1].error).toContain('Export failed for project p2');
    });

    it('should cancel batch mid-process', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
        ['p2', { videoUrl: 'https://example.com/v2.mp4', cost: 0.3, duration: 30 }],
        ['p3', { videoUrl: 'https://example.com/v3.mp4', cost: 0.2, duration: 20 }],
      ]);

      const cancelToken = createCancelToken();
      const callback: ExportProjectCallback = async (projectId) => {
        // Cancel after first project
        if (projectId === 'p1') {
          cancelToken.cancelled = true;
        }
        const result = results.get(projectId);
        if (!result) throw new Error(`No result for ${projectId}`);
        return result;
      };

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p2', title: 'Project 2', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p3', title: 'Project 3', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      const result = await orchestrateBatchExport(input, callback, cancelToken);

      expect(result.wasCancelled).toBe(true);
      expect(result.succeeded).toBe(1);
      expect(result.cancelled).toBeGreaterThanOrEqual(1);
    });

    it('should track timestamps for each item', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      const result = await orchestrateBatchExport(input, createMockExportCallback(results));

      expect(result.items[0].startedAt).toBeDefined();
      expect(result.items[0].completedAt).toBeDefined();
      expect(new Date(result.items[0].startedAt!).getTime()).toBeLessThanOrEqual(
        new Date(result.items[0].completedAt!).getTime(),
      );
    });

    it('should generate correct summary', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      const result = await orchestrateBatchExport(input, createMockExportCallback(results));

      expect(result.summary).toContain('all 1 projects exported successfully');
    });
  });

  describe('retryFailedBatchItems()', () => {
    it('should retry only failed items', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
        ['p2', { videoUrl: 'https://example.com/v2.mp4', cost: 0.3, duration: 30 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
          { projectId: 'p2', title: 'Project 2', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      // First batch: p2 fails
      const firstResult = await orchestrateBatchExport(
        input,
        createMockExportCallback(results, new Set(['p2'])),
      );

      expect(firstResult.failed).toBe(1);

      // Retry: p2 should succeed now
      const retryResult = await retryFailedBatchItems(
        firstResult,
        createMockExportCallback(results),
      );

      expect(retryResult.succeeded).toBe(1);
      expect(retryResult.failed).toBe(0);
    });

    it('should return same result if no failed items', async () => {
      const results = new Map<string, ExportProjectResult>([
        ['p1', { videoUrl: 'https://example.com/v1.mp4', cost: 0.5, duration: 15 }],
      ]);

      const input: BatchOrchestratorInput = {
        items: [
          { projectId: 'p1', title: 'Project 1', platforms: ['TIKTOK'], isReviewed: true },
        ],
      };

      const result = await orchestrateBatchExport(input, createMockExportCallback(results));
      const retryResult = await retryFailedBatchItems(result, createMockExportCallback(results));

      expect(retryResult.warnings).toContain('No failed items to retry.');
    });
  });

  describe('createCancelToken()', () => {
    it('should create a cancel token with cancelled=false', () => {
      const token = createCancelToken();
      expect(token.cancelled).toBe(false);
    });
  });
});

// ============================================================
// Export Manager Tests
// ============================================================

describe('VF-5.6: export-manager', () => {
  describe('extractKeywordsFromScript()', () => {
    it('should extract keywords from script', () => {
      const script = 'Suro berenang di laut dalam. Suro menemukan harta karun. Hiu besar mengejar Suro.';
      // With maxKeywords=5, top 5 by frequency then alphabetically: suro(3), besar, berenang, dalam, harta
      const keywords = extractKeywordsFromScript(script, 5);

      expect(keywords).toContain('suro');
      expect(keywords).toContain('harta');
      expect(keywords).toContain('berenang');
      expect(keywords).toContain('dalam');
    });

    it('should filter stop words', () => {
      const script = 'Suro dan Buya pergi ke laut. Mereka sangat senang.';
      const keywords = extractKeywordsFromScript(script, 10);

      // Stop words should be filtered out
      expect(keywords).not.toContain('dan');
      expect(keywords).not.toContain('ke');
      expect(keywords).not.toContain('sangat');
      expect(keywords).not.toContain('mereka');
    });

    it('should sort by frequency', () => {
      const script = 'Suro Suro Suro laut laut hiu';
      const keywords = extractKeywordsFromScript(script, 10);

      expect(keywords[0]).toBe('suro'); // appears 3 times
      expect(keywords[1]).toBe('laut'); // appears 2 times
      expect(keywords[2]).toBe('hiu'); // appears 1 time
    });

    it('should handle empty script', () => {
      const keywords = extractKeywordsFromScript('', 10);
      expect(keywords).toEqual([]);
    });

    it('should limit to maxKeywords', () => {
      const script = 'suro buya laut hiu harta karun petualangan teman keberanian';
      const keywords = extractKeywordsFromScript(script, 3);
      expect(keywords.length).toBeLessThanOrEqual(3);
    });
  });

  describe('generateHashtags()', () => {
    it('should generate hashtags from keywords', () => {
      const keywords = ['suro', 'laut', 'hiu'];
      const hashtags = generateHashtags(keywords, [], undefined, undefined, 10);

      expect(hashtags).toContain('suro');
      expect(hashtags).toContain('laut');
      expect(hashtags).toContain('hiu');
    });

    it('should add character name as hashtag (priority)', () => {
      const hashtags = generateHashtags(['laut'], [], 'Suro si Hiu', undefined, 10);

      // "Suro si Hiu" -> lowercase + remove non-alphanumeric -> "surosihiu"
      expect(hashtags[0]).toBe('surosihiu');
      expect(hashtags).toContain('laut');
    });

    it('should add series title as hashtag', () => {
      const hashtags = generateHashtags(['laut'], [], undefined, 'Petualangan Suro', 10);

      expect(hashtags).toContain('petualangansuro');
    });

    it('should add custom hashtags', () => {
      const hashtags = generateHashtags(['laut'], ['animasi', 'kartun'], undefined, undefined, 10);

      expect(hashtags).toContain('animasi');
      expect(hashtags).toContain('kartun');
    });

    it('should add generic hashtags', () => {
      const hashtags = generateHashtags([], [], undefined, undefined, 10);

      expect(hashtags).toContain('shortvideo');
      expect(hashtags).toContain('viral');
      expect(hashtags).toContain('fyp');
      expect(hashtags).toContain('foryou');
    });

    it('should ensure uniqueness', () => {
      const hashtags = generateHashtags(['suro'], ['suro'], 'suro', undefined, 10);

      const suroCount = hashtags.filter((h) => h === 'suro').length;
      expect(suroCount).toBe(1);
    });

    it('should limit to maxCount', () => {
      const keywords = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      const hashtags = generateHashtags(keywords, [], undefined, undefined, 5);

      expect(hashtags.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateExportMetadata()', () => {
    it('should generate metadata for multiple platforms', () => {
      const input: ExportMetadataInput = {
        title: 'Suro di Laut Dalam',
        script: 'Suro berenang di laut. Suro menemukan harta karun.',
        characterName: 'Suro',
        platforms: ['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS'],
      };

      const result = generateExportMetadata(input);

      expect(result.metadata).toHaveLength(3);
      expect(result.metadata[0].platform).toBe('TIKTOK');
      expect(result.metadata[1].platform).toBe('YOUTUBE_SHORTS');
      expect(result.metadata[2].platform).toBe('INSTAGRAM_REELS');
    });

    it('should include title in metadata', () => {
      const input: ExportMetadataInput = {
        title: 'Petualangan Suro',
        script: 'Suro berenang.',
        platforms: ['TIKTOK'],
      };

      const result = generateExportMetadata(input);

      expect(result.metadata[0].title).toBe('Petualangan Suro');
    });

    it('should include hashtags in caption', () => {
      const input: ExportMetadataInput = {
        title: 'Suro',
        script: 'Suro berenang di laut dalam',
        characterName: 'Suro',
        platforms: ['TIKTOK'],
      };

      const result = generateExportMetadata(input);

      expect(result.metadata[0].hashtags.length).toBeGreaterThan(0);
      expect(result.metadata[0].hashtagString).toContain('#');
    });

    it('should add episode info to title for series', () => {
      const input: ExportMetadataInput = {
        title: 'Petualangan Suro',
        script: 'Suro berenang.',
        seriesTitle: 'Series Suro',
        episodeOrder: 2,
        platforms: ['TIKTOK'],
      };

      const result = generateExportMetadata(input);

      expect(result.metadata[0].title).toContain('Ep 2');
    });

    it('should use platform-specific caption style', () => {
      const input: ExportMetadataInput = {
        title: 'Test',
        script: 'test script',
        platforms: ['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS'],
      };

      const result = generateExportMetadata(input);

      // YouTube should have subscribe CTA
      const youtubeMeta = result.metadata.find((m) => m.platform === 'YOUTUBE_SHORTS');
      expect(youtubeMeta?.caption).toContain('subscribe');

      // Instagram should have emoji
      const reelsMeta = result.metadata.find((m) => m.platform === 'INSTAGRAM_REELS');
      expect(reelsMeta?.caption).toContain('🎬');
    });

    it('should return empty metadata for no platforms', () => {
      const input: ExportMetadataInput = {
        title: 'Test',
        script: 'test',
        platforms: [],
      };

      const result = generateExportMetadata(input);

      expect(result.metadata).toEqual([]);
      expect(result.warnings).toContain('No platforms specified — returning empty metadata.');
    });

    it('should extract keywords from script', () => {
      const input: ExportMetadataInput = {
        title: 'Test',
        script: 'Suro berenang di laut. Suro menemukan harta karun.',
        platforms: ['TIKTOK'],
      };

      const result = generateExportMetadata(input);

      expect(result.extractedKeywords).toContain('suro');
      expect(result.extractedKeywords).toContain('laut');
      expect(result.extractedKeywords).toContain('harta');
    });

    it('should generate summary', () => {
      const input: ExportMetadataInput = {
        title: 'Test',
        script: 'test script',
        platforms: ['TIKTOK', 'YOUTUBE_SHORTS'],
      };

      const result = generateExportMetadata(input);

      expect(result.summary).toContain('2 platform(s)');
      expect(result.summary).toContain('TIKTOK, YOUTUBE_SHORTS');
    });
  });

  describe('getPlatformMetadataLimit()', () => {
    it('should return correct limits for TikTok', () => {
      const limit = getPlatformMetadataLimit('TIKTOK');

      expect(limit.maxCaptionLength).toBe(2200);
      expect(limit.maxHashtagCount).toBe(30);
      expect(limit.hashtagFormat).toBe('space');
      expect(limit.captionStyle).toBe('hashtag-heavy');
    });

    it('should return correct limits for YouTube Shorts', () => {
      const limit = getPlatformMetadataLimit('YOUTUBE_SHORTS');

      expect(limit.maxCaptionLength).toBe(5000);
      expect(limit.maxHashtagCount).toBe(15);
      expect(limit.hashtagFormat).toBe('comma');
      expect(limit.captionStyle).toBe('title-focused');
    });

    it('should return correct limits for Instagram Reels', () => {
      const limit = getPlatformMetadataLimit('INSTAGRAM_REELS');

      expect(limit.maxCaptionLength).toBe(2200);
      expect(limit.maxHashtagCount).toBe(30);
      expect(limit.hashtagFormat).toBe('space');
      expect(limit.captionStyle).toBe('emoji-heavy');
    });
  });

  describe('validateExportMetadata()', () => {
    it('should return empty errors for valid metadata', () => {
      const input: ExportMetadataInput = {
        title: 'Test Video',
        script: 'test script',
        platforms: ['TIKTOK'],
      };

      const result = generateExportMetadata(input);
      const errors = validateExportMetadata(result.metadata[0]);

      expect(errors).toEqual([]);
    });

    it('should detect title exceeding limit', () => {
      const longTitle = 'a'.repeat(200);
      const input: ExportMetadataInput = {
        title: longTitle,
        script: 'test',
        platforms: ['TIKTOK'],
      };

      const result = generateExportMetadata(input);
      const errors = validateExportMetadata(result.metadata[0]);

      // Title should be truncated, so it should be within limit
      // But let's test with a manually created metadata that exceeds
      const invalidMetadata = {
        platform: 'TIKTOK' as const,
        title: 'a'.repeat(200),
        caption: 'test',
        hashtags: [],
        hashtagString: '',
        captionTruncated: false,
        warnings: [],
      };

      const invalidErrors = validateExportMetadata(invalidMetadata);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors[0]).toContain('Title exceeds');
    });
  });
});