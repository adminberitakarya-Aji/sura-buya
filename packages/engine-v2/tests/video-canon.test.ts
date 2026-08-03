/**
 * Tests for VF-2.4 — Video canon check (validateVideoScript)
 *
 * Acceptance criteria: "Naskah yang melanggar persona karakter (karakter
 * penakut tiba-tiba ditulis sangat pemberani tanpa alasan) berhasil
 * di-flag oleh canon check sebelum lanjut ke storyboard"
 */

import { describe, it, expect } from 'vitest';
import { CanonValidator, RuleEngine, type VideoCanonContext } from '../src/validate/canon.js';
import type { VideoCharacterContext } from '@suro-buya/shared';

// ============================================================
// Test fixtures
// ============================================================

const mockCharacter: VideoCharacterContext = {
  id: 'char-001',
  characterId: 'suro',
  displayName: 'Suro',
  role: 'PROTAGONIST',
  description: 'Hiu kecil yang pemberani dan ingin tahu',
  coreTraits: ['pemberani', 'ingin tahu', 'setia kawan'],
  coreWeakness: 'Takut pada gelap',
  voiceGuide: 'Cara bicara ceria dan semangat',
  metadata: {
    species: 'anak hiu',
    ageDescriptor: 'anak-anak, sekitar 9 tahun',
    motivation: 'Ingin membuktikan bahwa hiu kecil juga bisa jadi pahlawan',
    visualDescription: 'Hiu kecil biru dengan mata besar',
    personaSource: 'ai-parsed',
  },
};

const mockCharacterPenakut: VideoCharacterContext = {
  id: 'char-002',
  characterId: 'kiko',
  displayName: 'Kiko',
  role: 'SUPPORTING',
  description: 'Kelinci yang penakut tapi baik hati',
  coreTraits: ['penakut', 'baik hati', 'hati-hati'],
  coreWeakness: 'Penakut',
  voiceGuide: 'Cara bicara pelan dan terbata-bata',
  metadata: {
    species: 'kelinci',
    ageDescriptor: 'anak-anak, sekitar 7 tahun',
    motivation: 'Ingin menjadi lebih berani',
    visualDescription: 'Kelinci putih kecil dengan telinga panjang',
    personaSource: 'manual',
  },
};

function createValidator(): CanonValidator {
  const ruleEngine = new RuleEngine([]);
  return new CanonValidator(ruleEngine, undefined, false);
}

// ============================================================
// Tests
// ============================================================

describe('video-canon — validateVideoScript basic', () => {
  it('should pass for script consistent with character persona', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter,
      contentRating: 'ALL_AGES',
    };

    const script = `Suro berenang menyusuri terumbu karang. Dia merasa pemberani hari ini.
SURO: "Aku akan menemukan harta karun itu!"
Suro berusaha meskipun sedikit takut pada gelap.`;

    const result = await validator.validateVideoScript(script, context);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn if character name not in script', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter,
      contentRating: 'ALL_AGES',
    };

    const script = 'Seorang hiu berpetualang di laut. Dia menemukan harta karun.';

    const result = await validator.validateVideoScript(script, context);
    // Should warn that character name "Suro" is not in script
    expect(result.warnings.some(w => w.code === 'video-character-name-presence')).toBe(true);
  });
});

// ============================================================
// CRITICAL: Persona contradiction detection
// Acceptance criteria: "karakter penakut tiba-tiba ditulis sangat
// pemberani tanpa alasan" harus di-flag
// ============================================================

describe('video-canon — persona contradiction detection (acceptance criteria)', () => {
  it('should FLAG when penakut character is described as sangat pemberani', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacterPenakut, // coreWeakness: 'Penakut', coreTraits: ['penakut', ...]
      contentRating: 'ALL_AGES',
    };

    // Script directly contradicts the character's core weakness
    const script = `Kiko sangat pemberani hari ini. Dia tidak takut sama sekali.
KIKO: "Aku tanpa rasa takut!"`;

    const result = await validator.validateVideoScript(script, context);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Should have persona-weakness-contradiction and/or persona-trait-contradiction
    const personaViolations = result.violations.filter(
      v => v.rule === 'video-persona-weakness-contradiction' || v.rule === 'video-persona-trait-contradiction'
    );
    expect(personaViolations.length).toBeGreaterThan(0);
  });

  it('should FLAG when character with "penakut" trait is described as berani sekali', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacterPenakut,
      contentRating: 'ALL_AGES',
    };

    const script = `Kiko berani sekali menghadapi monster itu.
KIKO: "Aku tidak takut!"`;

    const result = await validator.validateVideoScript(script, context);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should NOT flag when character acts consistently with persona', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacterPenakut,
      contentRating: 'ALL_AGES',
    };

    // Script is consistent — Kiko is scared but tries anyway (character growth, not contradiction)
    const script = `Kiko gemetar ketakutan, tapi ia mencoba mengumpulkan keberanian.
KIKO: "A-aku... aku akan coba..."`;

    const result = await validator.validateVideoScript(script, context);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should FLAG when pemberani character is described as penakut sekali', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter, // coreTraits: ['pemberani', ...]
      contentRating: 'ALL_AGES',
    };

    const script = `Suro penakut sekali hari ini. Dia lari ketakutan dari hiu besar.
SURO: "Aku tidak berani sama sekali!"`;

    const result = await validator.validateVideoScript(script, context);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('video-canon — series continuity', () => {
  it('should pass for standalone video without series context', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter,
      contentRating: 'ALL_AGES',
    };

    const script = 'Suro berpetualang di laut dan menemukan teman baru.';
    const result = await validator.validateVideoScript(script, context);
    // No series context — no continuity check
    expect(result.violations.some(v => v.rule === 'video-series-continuity-reference')).toBe(false);
  });

  it('should give info for episode 2+ without continuity reference', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter,
      contentRating: 'ALL_AGES',
      seriesContext: {
        seriesId: 'series-001',
        episodeOrder: 2,
        previousEpisodeSummaries: ['Suro menemukan harta karun di gua bawah laut'],
      },
    };

    // Script doesn't reference any events from previous episode
    const script = 'Suro bermain bola di pantai dengan teman-temannya.';
    const result = await validator.validateVideoScript(script, context);
    // Should have info-level violation about missing continuity reference
    expect(result.infos.some(i => i.code === 'video-series-continuity-reference')).toBe(true);
  });

  it('should pass when script references events from previous episode', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter,
      contentRating: 'ALL_AGES',
      seriesContext: {
        seriesId: 'series-001',
        episodeOrder: 2,
        previousEpisodeSummaries: ['Suro menemukan harta karun di gua bawah laut'],
      },
    };

    // Script references "harta" and "gua" from previous episode
    const script = 'Suro kembali ke gua tempat ia menemukan harta karun kemarin.';
    const result = await validator.validateVideoScript(script, context);
    // Should NOT have continuity reference violation
    expect(result.infos.some(i => i.code === 'video-series-continuity-reference')).toBe(false);
  });
});

describe('video-canon — consistency score', () => {
  it('should return high consistency score for clean script', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacter,
      contentRating: 'ALL_AGES',
    };

    const script = 'Suro berpetualang dengan pemberani dan ingin tahu.';
    const result = await validator.validateVideoScript(script, context);
    expect(result.consistencyScore).toBeGreaterThan(0.8);
  });

  it('should return lower consistency score for script with violations', async () => {
    const validator = createValidator();
    const context: VideoCanonContext = {
      character: mockCharacterPenakut,
      contentRating: 'ALL_AGES',
    };

    const script = 'Kiko sangat pemberani dan tidak takut sama sekali.';
    const result = await validator.validateVideoScript(script, context);
    expect(result.consistencyScore).toBeLessThan(0.8);
  });
});