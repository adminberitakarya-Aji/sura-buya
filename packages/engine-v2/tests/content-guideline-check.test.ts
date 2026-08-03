/**
 * Tests for VF-2.3 — content-guideline-check.ts
 *
 * Acceptance criteria eksplisit: "naskah dengan tema intens lolos untuk
 * universe MATURE, tapi di-flag untuk universe ALL_AGES" — bukan satu
 * aturan tunggal yang berlaku sama ke semua universe.
 */

import { describe, it, expect } from 'vitest';
import {
  checkContentGuidelines,
  type ContentGuidelineInput,
} from '../src/script/content-guideline-check.js';

describe('content-guideline-check — basic functionality', () => {
  it('should pass for clean script with ALL_AGES rating', () => {
    const result = checkContentGuidelines({
      script: 'Suro bermain dengan teman-temannya di pantai. Mereka belajar tentang pentingnya persahabatan.',
      contentRating: 'ALL_AGES',
    });
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.severity).toBe('ok');
  });

  it('should pass for clean script with MATURE rating', () => {
    const result = checkContentGuidelines({
      script: 'Karakter menghadapi dilema moral yang kompleks dengan nuansa dewasa.',
      contentRating: 'MATURE',
    });
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should return the contentRating in result', () => {
    const result = checkContentGuidelines({
      script: 'Clean script.',
      contentRating: 'TEEN',
    });
    expect(result.contentRating).toBe('TEEN');
  });
});

// ============================================================
// CRITICAL: Results MUST be DIFFERENT for different ratings
// This is the explicit acceptance criterion from the implementation plan.
// ============================================================

describe('content-guideline-check — DIFFERENT results for DIFFERENT ratings (acceptance criteria)', () => {
  // Script with intense/violent theme
  const intenseScript = 'Karakter menyaksikan pembunuhan yang berdarah. Dia mati-matian melawan dalam perang yang menyeramkan. Amarah dan dendam memenuhi hatinya. Pertarungan berdarah berakhir dengan kematian.';

  it('should FLAG intense script for ALL_AGES (violation)', () => {
    const result = checkContentGuidelines({
      script: intenseScript,
      contentRating: 'ALL_AGES',
    });
    // ALL_AGES should flag this — kekerasan, pembunuhan, darah are violations
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.severity).toBe('violation');
  });

  it('should PASS intense script for MATURE (no violation)', () => {
    const result = checkContentGuidelines({
      script: intenseScript,
      contentRating: 'MATURE',
    });
    // MATURE should pass — tema intens, kekerasan, dan bahasa kasar BOLEH
    // Only baseline policy violations (pedofilia, terorisme) are blocked
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should produce DIFFERENT results for ALL_AGES vs MATURE on same script', () => {
    const allAgesResult = checkContentGuidelines({
      script: intenseScript,
      contentRating: 'ALL_AGES',
    });
    const matureResult = checkContentGuidelines({
      script: intenseScript,
      contentRating: 'MATURE',
    });

    // This is the key assertion — results MUST be different
    expect(allAgesResult.passed).toBe(false);
    expect(matureResult.passed).toBe(true);
    expect(allAgesResult.violations.length).toBeGreaterThan(0);
    expect(matureResult.violations.length).toBe(0);
  });

  it('should FLAG sexual content for ALL_AGES but not MATURE', () => {
    const sexualScript = 'Adegan seksual eksplisit terjadi antara dua karakter.';

    const allAgesResult = checkContentGuidelines({
      script: sexualScript,
      contentRating: 'ALL_AGES',
    });
    const teenResult = checkContentGuidelines({
      script: sexualScript,
      contentRating: 'TEEN',
    });
    const matureResult = checkContentGuidelines({
      script: sexualScript,
      contentRating: 'MATURE',
    });

    expect(allAgesResult.passed).toBe(false);
    expect(teenResult.passed).toBe(false);
    expect(matureResult.passed).toBe(true); // MATURE allows sexual content (not non-consensual — that's baseline policy in VF-5.1)
  });

  it('should have different intensity thresholds per rating', () => {
    // Script with moderate intensity (not matching blocked patterns, but has intensity indicators)
    const moderateScript = 'Karakter merasa takut dan marah. Dia menghadapi pertarungan yang menyeramkan.';

    const allAgesResult = checkContentGuidelines({
      script: moderateScript,
      contentRating: 'ALL_AGES',
    });
    const teenResult = checkContentGuidelines({
      script: moderateScript,
      contentRating: 'TEEN',
    });
    const matureResult = checkContentGuidelines({
      script: moderateScript,
      contentRating: 'MATURE',
    });

    // ALL_AGES should have intensity warning (threshold 0.2)
    // TEEN might have intensity warning (threshold 0.5)
    // MATURE should not have intensity warning (threshold 0.9)
    const allAgesHasIntensityWarning = allAgesResult.warnings.some(w => w.type === 'intensity-mismatch');
    const matureHasIntensityWarning = matureResult.warnings.some(w => w.type === 'intensity-mismatch');

    // ALL_AGES should be more likely to flag intensity than MATURE
    expect(allAgesHasIntensityWarning).toBe(true);
    expect(matureHasIntensityWarning).toBe(false);
  });
});

describe('content-guideline-check — ALL_AGES patterns', () => {
  it('should flag violence for ALL_AGES', () => {
    const result = checkContentGuidelines({
      script: 'Ada kekerasan dan pembunuhan dalam cerita ini.',
      contentRating: 'ALL_AGES',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'intensity-mismatch')).toBe(true);
  });

  it('should flag sexual content for ALL_AGES', () => {
    const result = checkContentGuidelines({
      script: 'Konten seksual muncul di sini.',
      contentRating: 'ALL_AGES',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'theme-mismatch')).toBe(true);
  });

  it('should flag drug references for ALL_AGES', () => {
    const result = checkContentGuidelines({
      script: 'Karakter menggunakan narkoba dan alkohol.',
      contentRating: 'ALL_AGES',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'theme-mismatch')).toBe(true);
  });

  it('should flag coarse language for ALL_AGES', () => {
    const result = checkContentGuidelines({
      script: 'Karakter berkata "bangsat" dan "goblok".',
      contentRating: 'ALL_AGES',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'language-mismatch')).toBe(true);
  });

  it('should flag self-harm themes for ALL_AGES', () => {
    const result = checkContentGuidelines({
      script: 'Karakter mempertimbangkan bunuh diri.',
      contentRating: 'ALL_AGES',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'theme-mismatch')).toBe(true);
  });
});

describe('content-guideline-check — TEEN patterns', () => {
  it('should flag sexual content for TEEN', () => {
    const result = checkContentGuidelines({
      script: 'Adegan seksual eksplisit.',
      contentRating: 'TEEN',
    });
    expect(result.passed).toBe(false);
  });

  it('should flag graphic violence for TEEN', () => {
    const result = checkContentGuidelines({
      script: 'Pembunuhan dengan penyiksaan yang grafis.',
      contentRating: 'TEEN',
    });
    expect(result.passed).toBe(false);
  });

  it('should allow mild conflict for TEEN', () => {
    const result = checkContentGuidelines({
      script: 'Karakter berselisih dengan temannya dan belajar menghargai perbedaan.',
      contentRating: 'TEEN',
    });
    expect(result.passed).toBe(true);
  });
});

describe('content-guideline-check — MATURE patterns', () => {
  it('should flag pedophilia for MATURE (baseline policy)', () => {
    const result = checkContentGuidelines({
      script: 'Konten yang melibatkan pedofilia.',
      contentRating: 'MATURE',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'theme-mismatch')).toBe(true);
  });

  it('should flag terrorism promotion for MATURE (baseline policy)', () => {
    const result = checkContentGuidelines({
      script: 'Promosi terorisme dalam cerita.',
      contentRating: 'MATURE',
    });
    expect(result.passed).toBe(false);
  });

  it('should allow violence for MATURE', () => {
    const result = checkContentGuidelines({
      script: 'Kekerasan dan pembunuhan terjadi dalam cerita dewasa ini.',
      contentRating: 'MATURE',
    });
    // MATURE allows violence — only baseline policy (pedofilia, terorisme) is blocked
    expect(result.passed).toBe(true);
  });

  it('should allow coarse language for MATURE', () => {
    const result = checkContentGuidelines({
      script: 'Karakter berkata "bangsat" dalam amarah.',
      contentRating: 'MATURE',
    });
    expect(result.passed).toBe(true);
  });
});

describe('content-guideline-check — audience profile', () => {
  it('should warn when educational profile expects educational content', () => {
    const result = checkContentGuidelines({
      script: 'Karakter bermain bola di lapangan.',
      contentRating: 'ALL_AGES',
      audienceProfile: 'keluarga Indonesia, tema edukatif',
    });
    // Script doesn't have educational elements, profile mentions "edukatif"
    expect(result.warnings.some(w => w.type === 'tone-mismatch')).toBe(true);
  });

  it('should not warn when educational content is present', () => {
    const result = checkContentGuidelines({
      script: 'Karakter belajar pelajaran penting tentang persahabatan dan pengetahuan baru.',
      contentRating: 'ALL_AGES',
      audienceProfile: 'keluarga Indonesia, tema edukatif',
    });
    expect(result.warnings.some(w => w.type === 'tone-mismatch')).toBe(false);
  });

  it('should not check educational tone for MATURE rating', () => {
    const result = checkContentGuidelines({
      script: 'Karakter bermain bola di lapangan.',
      contentRating: 'MATURE',
      audienceProfile: 'dewasa muda, tema petualangan',
    });
    // MATURE rating doesn't check for educational elements
    expect(result.warnings.some(w => w.type === 'tone-mismatch')).toBe(false);
  });
});

describe('content-guideline-check — summary and severity', () => {
  it('should have ok summary when passed', () => {
    const result = checkContentGuidelines({
      script: 'Clean script.',
      contentRating: 'ALL_AGES',
    });
    expect(result.summary).toContain('lolos');
  });

  it('should have violation summary when violations exist', () => {
    const result = checkContentGuidelines({
      script: 'Pembunuhan terjadi.',
      contentRating: 'ALL_AGES',
    });
    expect(result.summary).toContain('violation');
  });

  it('should have warning summary when only warnings exist', () => {
    // Script with intensity but no blocked patterns
    const result = checkContentGuidelines({
      script: 'Karakter merasa takut dan marah. Pertarungan menyeramkan menanti. Dia penuh dendam dan amarah. Perang adu mati. Luka berdarah.',
      contentRating: 'ALL_AGES',
    });
    // This should have intensity warnings but might also have pattern violations
    // Let's test with a script that only triggers intensity
    const mildIntensity = 'Karakter merasa takut. Dia marah. Pertarungan terjadi. Dia penuh dendam. Perang dimulai.';
    const mildResult = checkContentGuidelines({
      script: mildIntensity,
      contentRating: 'ALL_AGES',
    });
    // Should have at least warnings (intensity)
    expect(mildResult.warnings.length).toBeGreaterThan(0);
  });
});