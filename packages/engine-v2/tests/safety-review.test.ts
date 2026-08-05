/**
 * Tests for VF-5.1 — safety-review.ts
 *
 * Acceptance criteria eksplisit (IMPLEMENTATION-PLAN-VIDEO-FACTORY.md §8):
 * - Konten yang melanggar baseline platform policy (konten ilegal/ujaran kebencian)
 *   berhasil diblokir dari export otomatis, berlaku sama di universe manapun
 * - Video di universe ALL_AGES yang isinya tidak cocok dengan rating tersebut
 *   menghasilkan warning ke creator, BUKAN hard-block
 * - Video di universe MATURE dengan tema intens TIDAK ikut ter-flag oleh
 *   aturan yang sama seperti universe ALL_AGES
 * - Workflow Temporal pause/resume untuk human approval (VF-5.4) —
 *   requiresHumanApproval() return true untuk baseline violation
 */

import { describe, it, expect, vi } from 'vitest';
import {
  checkBaselinePolicy,
  reviewSafety,
  isExportAllowed,
  requiresHumanApproval,
  type SafetyReviewInput,
  type SafetyFinding,
} from '../src/validate/safety-review.js';
import type { AIProvider, AIResponse, AIProviderOptions } from '../src/ai/providers.js';

// ============================================================
// Mock AIProvider untuk LLM classifier (lapis 2)
// ============================================================

function createMockProvider(responseContent: string): AIProvider {
  return {
    name: 'mock',
    version: '1.0.0',
    async generate(_prompt: string, _options: AIProviderOptions): Promise<AIResponse> {
      return {
        content: responseContent,
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'mock-model',
        provider: 'mock',
        latency: 10,
      };
    },
    async *generateStream() {
      yield '';
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
    async getModels(): Promise<string[]> {
      return ['mock-model'];
    },
  };
}

// ============================================================
// Lapis 1 — Baseline Platform Policy (deterministik)
// ============================================================

describe('safety-review — baseline policy (lapis 1, deterministik)', () => {
  it('should pass clean content with no baseline violations', () => {
    const findings = checkBaselinePolicy('Suro bermain dengan teman-temannya di pantai. Mereka belajar tentang persahabatan.');
    expect(findings).toHaveLength(0);
  });

  it('should flag CSAM content (illegal)', () => {
    const findings = checkBaselinePolicy('Konten yang melibatkan pedofilia dan pelecehan seksual anak.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].layer).toBe('baseline-policy');
    expect(findings[0].severity).toBe('block');
    expect(findings[0].category).toBe('illegal-content');
  });

  it('should flag terrorism promotion (violence-promotion)', () => {
    const findings = checkBaselinePolicy('Video ini berisi promosi terorisme dan inciting violence.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('block');
    expect(findings[0].category).toBe('violence-promotion');
  });

  it('should flag racial hate speech', () => {
    const findings = checkBaselinePolicy('Narasi yang menyebut bangsa kafir dan ethnic cleansing.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('hate-speech');
  });

  it('should flag religious hate speech', () => {
    const findings = checkBaselinePolicy('Konten yang menghasut kill all muslims.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('hate-speech');
  });

  it('should flag non-consensual intimate imagery (revenge porn)', () => {
    const findings = checkBaselinePolicy('Referensi ke revenge porn dan non-consensual intimate image.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('non-consensual-sexual-content');
  });

  it('should flag sexual violence depiction (rape)', () => {
    const findings = checkBaselinePolicy('Adegan pemerkosaan dan sexual assault dalam cerita.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('non-consensual-sexual-content');
  });

  it('should flag self-harm promotion', () => {
    const findings = checkBaselinePolicy('Konten yang encouraging self-harm dan how to commit suicide.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('violence-promotion');
  });

  it('should flag drug manufacturing instructions', () => {
    const findings = checkBaselinePolicy('Video berisi cara membuat narkoba dan drug manufacturing recipe.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('illegal-content');
  });

  it('should always set confidence to 1.0 for baseline policy (deterministic)', () => {
    const findings = checkBaselinePolicy('Konten pedofilia di sini.');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].confidence).toBe(1.0);
  });
});

// ============================================================
// CRITICAL: Baseline policy berlaku SAMA di SEMUA universe
// Acceptance criteria: "berlaku sama di universe manapun tanpa terkecuali"
// ============================================================

describe('safety-review — baseline policy berlaku sama di SEMUA rating (acceptance criteria)', () => {
  const illegalContent = 'Konten yang berisi pedofilia dan promosi terorisme.';

  it('should block illegal content in ALL_AGES universe', async () => {
    const result = await reviewSafety({
      content: illegalContent,
      contentRating: 'ALL_AGES',
    });
    expect(result.hasBaselineViolation).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.overallSeverity).toBe('blocked');
  });

  it('should block illegal content in TEEN universe', async () => {
    const result = await reviewSafety({
      content: illegalContent,
      contentRating: 'TEEN',
    });
    expect(result.hasBaselineViolation).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.overallSeverity).toBe('blocked');
  });

  it('should block illegal content in MATURE universe', async () => {
    const result = await reviewSafety({
      content: illegalContent,
      contentRating: 'MATURE',
    });
    expect(result.hasBaselineViolation).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.overallSeverity).toBe('blocked');
  });

  it('should produce IDENTICAL baseline findings across all ratings', async () => {
    const allAgesResult = await reviewSafety({ content: illegalContent, contentRating: 'ALL_AGES' });
    const teenResult = await reviewSafety({ content: illegalContent, contentRating: 'TEEN' });
    const matureResult = await reviewSafety({ content: illegalContent, contentRating: 'MATURE' });

    // Baseline findings harus identik di semua rating
    expect(allAgesResult.baselinePolicyFindings.length).toBe(teenResult.baselinePolicyFindings.length);
    expect(teenResult.baselinePolicyFindings.length).toBe(matureResult.baselinePolicyFindings.length);

    // Semua harus blocked
    expect(allAgesResult.overallSeverity).toBe('blocked');
    expect(teenResult.overallSeverity).toBe('blocked');
    expect(matureResult.overallSeverity).toBe('blocked');
  });
});

// ============================================================
// CRITICAL: MATURE dengan tema intens TIDAK ter-flag oleh aturan ALL_AGES
// Acceptance criteria: "dua universe rating berbeda diuji berdampingan"
// ============================================================

describe('safety-review — MATURE tema intens tidak ter-flag (acceptance criteria)', () => {
  // Script dengan tema intens (kekerasan, bahasa kasar) — BOLEH untuk MATURE
  const intenseScript = 'Karakter menyaksikan pembunuhan berdarah. Dia berkata "bangsat" dan penuh amarah. Pertarungan berdarah berakhir dengan kematian.';

  it('should PASS intense content for MATURE (no baseline violation)', async () => {
    const result = await reviewSafety({
      content: intenseScript,
      contentRating: 'MATURE',
    });
    // MATURE allows intense themes — baseline policy tidak flag kekerasan/bahasa kasar biasa
    expect(result.hasBaselineViolation).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('should NOT block intense content for MATURE even with LLM classifier', async () => {
    // LLM classifier return warning untuk MATURE, tapi tidak block
    const mockProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'intensity-mismatch',
        severity: 'info', // MATURE — hanya info, bukan warning
        message: 'Konten intens tapi sesuai rating MATURE.',
        confidence: 0.3,
      }],
      overallConsistency: 0.9,
      summary: 'Konten konsisten dengan MATURE.',
    }));

    const result = await reviewSafety({
      content: intenseScript,
      contentRating: 'MATURE',
    }, mockProvider);

    expect(result.hasBaselineViolation).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.hasRatingWarning).toBe(false); // info, bukan warning
  });

  it('should produce DIFFERENT results for ALL_AGES vs MATURE on same intense script', async () => {
    // ALL_AGES dengan LLM classifier → warning (tidak cocok rating)
    // MATURE dengan LLM classifier → info atau tidak ada finding (cocok rating)
    const allAgesProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'rating-mismatch',
        severity: 'warning',
        message: 'Konten kekerasan tidak cocok untuk ALL_AGES.',
        confidence: 0.9,
      }],
      overallConsistency: 0.3,
      summary: 'Tidak konsisten dengan ALL_AGES.',
    }));

    const matureProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'intensity-mismatch',
        severity: 'info',
        message: 'Konten intens tapi sesuai MATURE.',
        confidence: 0.3,
      }],
      overallConsistency: 0.9,
      summary: 'Konsisten dengan MATURE.',
    }));

    const allAgesResult = await reviewSafety({
      content: intenseScript,
      contentRating: 'ALL_AGES',
    }, allAgesProvider);

    const matureResult = await reviewSafety({
      content: intenseScript,
      contentRating: 'MATURE',
    }, matureProvider);

    // Key assertion: results MUST be different
    expect(allAgesResult.hasRatingWarning).toBe(true);
    expect(matureResult.hasRatingWarning).toBe(false);
    expect(allAgesResult.overallSeverity).toBe('warning');
    expect(matureResult.overallSeverity).toBe('ok');
  });
});

// ============================================================
// Rating-consistency = WARNING, bukan hard-block
// Acceptance criteria: "bukan hard-block — creator tetap bisa export"
// ============================================================

describe('safety-review — rating-consistency adalah warning, bukan block', () => {
  it('should NOT block export for rating-consistency warning', async () => {
    const mockProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'rating-mismatch',
        severity: 'warning',
        message: 'Konten kekerasan tidak cocok untuk ALL_AGES.',
        confidence: 0.9,
      }],
      overallConsistency: 0.3,
      summary: 'Tidak konsisten dengan ALL_AGES.',
    }));

    const result = await reviewSafety({
      content: 'Karakter menyaksikan pertarungan yang menegangkan.',
      contentRating: 'ALL_AGES',
    }, mockProvider);

    // Warning ada, tapi export tetap diizinkan
    expect(result.hasRatingWarning).toBe(true);
    expect(result.hasBaselineViolation).toBe(false);
    expect(result.passed).toBe(true); // passed = tidak ada baseline violation
    expect(isExportAllowed(result)).toBe(true);
  });

  it('should only block export for baseline policy violation', async () => {
    const result = await reviewSafety({
      content: 'Konten pedofilia di sini.',
      contentRating: 'ALL_AGES',
    });

    expect(result.hasBaselineViolation).toBe(true);
    expect(result.passed).toBe(false);
    expect(isExportAllowed(result)).toBe(false);
  });
});

// ============================================================
// Human approval logic (VF-5.4 preparation)
// ============================================================

describe('safety-review — requiresHumanApproval (VF-5.4 preparation)', () => {
  it('should require human approval for baseline violation', async () => {
    const result = await reviewSafety({
      content: 'Konten ujaran kebencian: kill all muslims.',
      contentRating: 'MATURE',
    });

    expect(requiresHumanApproval(result)).toBe(true);
  });

  it('should NOT require human approval for rating-consistency warning only', async () => {
    const mockProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'rating-mismatch',
        severity: 'warning',
        message: 'Tidak cocok untuk ALL_AGES.',
        confidence: 0.9,
      }],
      overallConsistency: 0.3,
      summary: 'Warning.',
    }));

    const result = await reviewSafety({
      content: 'Konten menegangkan.',
      contentRating: 'ALL_AGES',
    }, mockProvider);

    expect(requiresHumanApproval(result)).toBe(false);
  });

  it('should NOT require human approval for clean content', async () => {
    const result = await reviewSafety({
      content: 'Suro bermain dengan teman-temannya.',
      contentRating: 'ALL_AGES',
    });

    expect(requiresHumanApproval(result)).toBe(false);
  });
});

// ============================================================
// reviewSafety() — orchestrator lengkap
// ============================================================

describe('safety-review — reviewSafety() orchestrator', () => {
  it('should run baseline policy even without LLM provider', async () => {
    const result = await reviewSafety({
      content: 'Konten pedofilia.',
      contentRating: 'ALL_AGES',
    });

    expect(result.llmClassifierUsed).toBe(false);
    expect(result.baselinePolicyFindings.length).toBeGreaterThan(0);
    expect(result.ratingConsistencyFindings).toHaveLength(0);
  });

  it('should run both layers when provider is available', async () => {
    const mockProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'tone-mismatch',
        severity: 'info',
        message: 'Info finding.',
        confidence: 0.5,
      }],
      overallConsistency: 0.8,
      summary: 'OK.',
    }));

    const result = await reviewSafety({
      content: 'Konten bersih.',
      contentRating: 'TEEN',
    }, mockProvider);

    expect(result.llmClassifierUsed).toBe(true);
    expect(result.ratingConsistencyFindings.length).toBeGreaterThan(0);
  });

  it('should handle LLM error gracefully (return empty, not block)', async () => {
    const errorProvider: AIProvider = {
      name: 'error-provider',
      version: '1.0.0',
      async generate(): Promise<AIResponse> {
        throw new Error('LLM API error');
      },
      async *generateStream() { yield ''; },
      async isAvailable() { return false; },
      async getModels() { return []; },
    };

    const result = await reviewSafety({
      content: 'Konten bersih.',
      contentRating: 'ALL_AGES',
    }, errorProvider);

    // LLM error tidak boleh block export
    expect(result.passed).toBe(true);
    expect(result.ratingConsistencyFindings).toHaveLength(0);
    expect(result.llmClassifierUsed).toBe(true);
  });

  it('should include contentRating in result', async () => {
    const result = await reviewSafety({
      content: 'Clean content.',
      contentRating: 'TEEN',
    });
    expect(result.contentRating).toBe('TEEN');
  });

  it('should combine all findings in allFindings', async () => {
    const mockProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'tone-mismatch',
        severity: 'info',
        message: 'Info.',
        confidence: 0.5,
      }],
      overallConsistency: 0.8,
      summary: 'OK.',
    }));

    const result = await reviewSafety({
      content: 'Konten pedofilia dengan tone mismatch.',
      contentRating: 'ALL_AGES',
    }, mockProvider);

    expect(result.allFindings.length).toBe(
      result.baselinePolicyFindings.length + result.ratingConsistencyFindings.length
    );
  });
});

// ============================================================
// Summary dan overallSeverity
// ============================================================

describe('safety-review — summary and severity', () => {
  it('should have ok severity for clean content', async () => {
    const result = await reviewSafety({
      content: 'Suro belajar tentang persahabatan.',
      contentRating: 'ALL_AGES',
    });
    expect(result.overallSeverity).toBe('ok');
    expect(result.summary).toContain('lolos');
  });

  it('should have blocked severity for baseline violation', async () => {
    const result = await reviewSafety({
      content: 'Konten pedofilia.',
      contentRating: 'ALL_AGES',
    });
    expect(result.overallSeverity).toBe('blocked');
    expect(result.summary).toContain('diblokir');
  });

  it('should have warning severity for rating-consistency warning', async () => {
    const mockProvider = createMockProvider(JSON.stringify({
      findings: [{
        category: 'rating-mismatch',
        severity: 'warning',
        message: 'Warning.',
        confidence: 0.9,
      }],
      overallConsistency: 0.3,
      summary: 'Warning.',
    }));

    const result = await reviewSafety({
      content: 'Konten menegangkan.',
      contentRating: 'ALL_AGES',
    }, mockProvider);

    expect(result.overallSeverity).toBe('warning');
    expect(result.summary).toContain('warning');
  });
});

// ============================================================
// videoMetadata — LLM classifier dengan metadata tambahan
// ============================================================

describe('safety-review — videoMetadata', () => {
  it('should pass videoMetadata to LLM classifier', async () => {
    let capturedPrompt = '';
    const capturingProvider: AIProvider = {
      name: 'capturing',
      version: '1.0.0',
      async generate(prompt: string): Promise<AIResponse> {
        capturedPrompt = prompt;
        return {
          content: JSON.stringify({ findings: [], overallConsistency: 1, summary: 'OK' }),
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'mock',
          provider: 'mock',
          latency: 10,
        };
      },
      async *generateStream() { yield ''; },
      async isAvailable() { return true; },
      async getModels() { return ['mock']; },
    };

    await reviewSafety({
      content: 'Konten utama.',
      contentRating: 'ALL_AGES',
      audienceProfile: 'keluarga Indonesia',
      videoMetadata: {
        title: 'Episode 1: Petualangan',
        shotDescriptions: ['Shot 1: Karakter berlari', 'Shot 2: Karakter tersenyum'],
        dialogueText: 'Halo teman!',
      },
    }, capturingProvider);

    expect(capturedPrompt).toContain('Episode 1: Petualangan');
    expect(capturedPrompt).toContain('Shot 1: Karakter berlari');
    expect(capturedPrompt).toContain('Halo teman!');
    expect(capturedPrompt).toContain('keluarga Indonesia');
  });
});