/**
 * VF-2.7 — Integration test for VF-2 (Script → Storyboard + Series/Continuity)
 *
 * Verifies acceptance criteria end-to-end:
 * 1. User can create standalone video OR add to VideoSeries with same character
 * 2. Episode 2+ script considers previous episode context (continuity)
 * 3. Script violating persona is flagged by canon check
 * 4. Content guideline check produces different results for different ratings
 * 5. Shot list is valid and ready for VF-3
 */

import { describe, it, expect } from 'vitest';
import {
  generateBeatSheet,
  validateScriptAgainstBeats,
  estimateTotalShotCount,
} from '../src/script/beat-sheet.js';
import {
  checkContentGuidelines,
} from '../src/script/content-guideline-check.js';
import {
  generateScript,
  buildSeriesContextPrompt,
  type ScriptGeneratorInput,
  type SeriesContext,
} from '../src/script/script-generator.js';
import {
  breakDownScript,
} from '../src/storyboard/scene-breakdown.js';
import {
  buildAllPrompts,
} from '../src/storyboard/prompt-builder.js';
import {
  CanonValidator,
  RuleEngine,
  type VideoCanonContext,
} from '../src/validate/canon.js';
import type { AIProvider, AIResponse, AIProviderOptions } from '../src/ai/providers.js';
import type { VideoCharacterContext, ContentRating } from '@suro-buya/shared';

// ============================================================
// Mock AI Provider
// ============================================================

class MockAIProvider implements AIProvider {
  readonly name = 'mock-vf2';
  readonly version = '1.0.0';

  async generate(_prompt: string, _opts: AIProviderOptions): Promise<AIResponse> {
    return {
      content: `Judul: Petualangan Suro

[Beat 1: Hook]
[Suro berenang menyusuri terumbu karang yang berwarna-warni]
SURO: "Wow, lihat itu! Ada cahaya emas di dasar laut!"

[Beat 2: Conflict]
[Tiba-tiba hiu besar muncul dari kegelapan]
SURO: "A-aku takut... tapi aku harus berani!"

[Beat 3: Punchline]
[Ternyata cahaya emas itu cuma kerang yang memantulkan sinar matahari]
SURO: "Haha, ternyata bukan harta karun! Tapi petualangan ini sendiri yang berharga!"`,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'mock-model',
      provider: this.name,
      latency: 50,
    };
  }

  async *generateStream(): AsyncIterable<string> { yield ''; }
  async isAvailable(): Promise<boolean> { return true; }
  async getModels(): Promise<string[]> { return ['mock-model']; }
}

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
    visualDescription: 'Hiu kecil biru dengan mata besar dan senyum lebar',
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

// ============================================================
// Tests
// ============================================================

describe('VF-2 Integration — Acceptance Criteria', () => {
  const provider = new MockAIProvider();

  // AC 1: User can create standalone video OR add to VideoSeries
  describe('AC1: Standalone vs Series', () => {
    it('should generate script for standalone video (no series context)', async () => {
      const input: ScriptGeneratorInput = {
        character: mockCharacter,
        storyIdea: 'Suro menemukan harta karun',
        targetDuration: 15,
        contentRating: 'ALL_AGES',
      };

      const result = await generateScript(input, provider);
      expect(result.script).toBeTruthy();
      expect(result.title).toBeTruthy();
      expect(result.beatSheet.duration).toBe(15);
    });

    it('should generate script for series episode with continuity context', async () => {
      const seriesContext: SeriesContext = {
        seriesId: 'series-001',
        episodeOrder: 2,
        previousEpisodes: [
          {
            episodeOrder: 1,
            title: 'Suro dan Harta Karun',
            script: 'Suro menemukan harta karun di gua bawah laut',
            summary: 'Suro menemukan harta karun di gua bawah laut',
          },
        ],
      };

      const input: ScriptGeneratorInput = {
        character: mockCharacter,
        storyIdea: 'Suro kembali ke gua',
        targetDuration: 15,
        contentRating: 'ALL_AGES',
        seriesContext,
      };

      const result = await generateScript(input, provider);
      expect(result.script).toBeTruthy();
    });

    it('should build series context prompt with previous episodes', () => {
      const ctx: SeriesContext = {
        seriesId: 'series-001',
        episodeOrder: 2,
        previousEpisodes: [
          {
            episodeOrder: 1,
            title: 'Episode 1',
            script: 'Naskah episode 1...',
            summary: 'Suro menemukan harta',
          },
        ],
      };

      const prompt = buildSeriesContextPrompt(ctx);
      expect(prompt).toContain('episode 2');
      expect(prompt).toContain('Episode 1');
      expect(prompt).toContain('continuity');
    });
  });

  // AC 2: Episode 2+ script considers previous episode context
  describe('AC2: Series continuity', () => {
    it('should include previous episode summaries in series context', () => {
      const ctx: SeriesContext = {
        seriesId: 'series-001',
        episodeOrder: 3,
        previousEpisodes: [
          { episodeOrder: 1, title: 'Ep1', script: 's1', summary: 'Suro menemukan gua' },
          { episodeOrder: 2, title: 'Ep2', script: 's2', summary: 'Suro bertemu Kiko' },
        ],
      };

      const prompt = buildSeriesContextPrompt(ctx);
      expect(prompt).toContain('episode 3');
      expect(prompt).toContain('Ep1');
      expect(prompt).toContain('Ep2');
      expect(prompt).toContain('Suro menemukan gua');
      expect(prompt).toContain('Suro bertemu Kiko');
    });
  });

  // AC 3: Script violating persona is flagged by canon check
  describe('AC3: Persona violation detection', () => {
    it('should flag penakut character described as sangat pemberani', async () => {
      const validator = new CanonValidator(new RuleEngine([]), undefined, false);
      const context: VideoCanonContext = {
        character: mockCharacterPenakut,
        contentRating: 'ALL_AGES',
      };

      const script = 'Kiko sangat pemberani hari ini. Dia tidak takut sama sekali.';
      const result = await validator.validateVideoScript(script, context);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should flag pemberani character described as penakut sekali', async () => {
      const validator = new CanonValidator(new RuleEngine([]), undefined, false);
      const context: VideoCanonContext = {
        character: mockCharacter,
        contentRating: 'ALL_AGES',
      };

      const script = 'Suro penakut sekali. Dia lari ketakutan.';
      const result = await validator.validateVideoScript(script, context);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should NOT flag consistent character behavior', async () => {
      const validator = new CanonValidator(new RuleEngine([]), undefined, false);
      const context: VideoCanonContext = {
        character: mockCharacterPenakut,
        contentRating: 'ALL_AGES',
      };

      const script = 'Kiko gemetar ketakutan, tapi mencoba mengumpulkan keberanian.';
      const result = await validator.validateVideoScript(script, context);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // AC 4: Content guideline check produces different results for different ratings
  describe('AC4: Different results for different ratings', () => {
    const intenseScript = 'Karakter menyaksikan pembunuhan yang berdarah. Dia mati-matian melawan dalam perang yang menyeramkan.';

    it('should FLAG intense script for ALL_AGES', () => {
      const result = checkContentGuidelines({
        script: intenseScript,
        contentRating: 'ALL_AGES',
      });
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should PASS intense script for MATURE', () => {
      const result = checkContentGuidelines({
        script: intenseScript,
        contentRating: 'MATURE',
      });
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should produce DIFFERENT results for ALL_AGES vs MATURE', () => {
      const allAges = checkContentGuidelines({ script: intenseScript, contentRating: 'ALL_AGES' });
      const mature = checkContentGuidelines({ script: intenseScript, contentRating: 'MATURE' });
      expect(allAges.passed).toBe(false);
      expect(mature.passed).toBe(true);
    });
  });

  // AC 5: Shot list is valid and ready for VF-3
  describe('AC5: Shot list valid for VF-3', () => {
    it('should generate valid ShotSpec[] from script', async () => {
      // Generate script first
      const scriptInput: ScriptGeneratorInput = {
        character: mockCharacter,
        storyIdea: 'Suro menemukan harta karun',
        targetDuration: 15,
        contentRating: 'ALL_AGES',
      };
      const scriptResult = await generateScript(scriptInput, provider);

      // Break down into shots
      const breakdownResult = breakDownScript({
        script: scriptResult.script,
        beatSheet: scriptResult.beatSheet,
        character: mockCharacter,
      });

      expect(breakdownResult.shots.length).toBeGreaterThan(0);
      expect(breakdownResult.totalDuration).toBeGreaterThan(0);

      // Verify each shot has required fields
      for (const shot of breakdownResult.shots) {
        expect(shot.index).toBeGreaterThanOrEqual(0);
        expect(shot.cameraAngle).toBeTruthy();
        expect(shot.duration).toBeGreaterThan(0);
        expect(shot.action).toBeTruthy();
        expect(shot.visualPrompt).toBeTruthy();
      }
    });

    it('should build prompts for each shot', async () => {
      const scriptInput: ScriptGeneratorInput = {
        character: mockCharacter,
        storyIdea: 'Suro berpetualang',
        targetDuration: 15,
        contentRating: 'ALL_AGES',
      };
      const scriptResult = await generateScript(scriptInput, provider);
      const breakdownResult = breakDownScript({
        script: scriptResult.script,
        beatSheet: scriptResult.beatSheet,
        character: mockCharacter,
      });

      for (const shot of breakdownResult.shots) {
        const prompts = buildAllPrompts({
          shot,
          visualProfile: mockCharacter.visualProfile,
        });
        expect(prompts.visualPrompt).toBeTruthy();
        expect(prompts.motionPrompt).toBeTruthy();
        expect(prompts.negativePrompt).toBeTruthy();
      }
    });

    it('should validate script against beat sheet', async () => {
      const scriptInput: ScriptGeneratorInput = {
        character: mockCharacter,
        storyIdea: 'Suro berpetualang di laut',
        targetDuration: 30,
        contentRating: 'ALL_AGES',
      };
      const scriptResult = await generateScript(scriptInput, provider);

      const validation = validateScriptAgainstBeats(scriptResult.script, scriptResult.beatSheet);
      expect(validation.estimatedShotCount).toBeGreaterThan(0);
    });
  });

  // End-to-end flow
  describe('End-to-end: Script → Canon → Storyboard', () => {
    it('should complete full pipeline: generate → check → breakdown', async () => {
      // 1. Generate script
      const scriptInput: ScriptGeneratorInput = {
        character: mockCharacter,
        storyIdea: 'Suro menemukan harta karun di dasar laut',
        targetDuration: 15,
        contentRating: 'ALL_AGES',
      };
      const scriptResult = await generateScript(scriptInput, provider);
      expect(scriptResult.script).toBeTruthy();

      // 2. Canon check
      const validator = new CanonValidator(new RuleEngine([]), undefined, false);
      const canonResult = await validator.validateVideoScript(scriptResult.script, {
        character: mockCharacter,
        contentRating: 'ALL_AGES',
      });
      // Script should pass canon check (consistent with persona)
      expect(canonResult.errors).toHaveLength(0);

      // 3. Content guideline check
      const guidelineResult = checkContentGuidelines({
        script: scriptResult.script,
        contentRating: 'ALL_AGES',
      });
      expect(guidelineResult.passed).toBe(true);

      // 4. Break down into storyboard
      const breakdownResult = breakDownScript({
        script: scriptResult.script,
        beatSheet: scriptResult.beatSheet,
        character: mockCharacter,
      });
      expect(breakdownResult.shots.length).toBeGreaterThan(0);

      // 5. Build prompts for each shot
      for (const shot of breakdownResult.shots) {
        const prompts = buildAllPrompts({
          shot,
          visualProfile: mockCharacter.visualProfile,
        });
        expect(prompts.visualPrompt).toContain('9:16');
      }
    });
  });
});