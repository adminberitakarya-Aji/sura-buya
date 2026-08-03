/**
 * Tests for VF-2.5 — scene-breakdown.ts + prompt-builder.ts
 */

import { describe, it, expect } from 'vitest';
import {
  breakDownScript,
  type SceneBreakdownInput,
} from '../src/storyboard/scene-breakdown.js';
import {
  buildVisualPrompt,
  buildMotionPrompt,
  buildNegativePrompt,
  buildAllPrompts,
  type PromptBuilderInput,
} from '../src/storyboard/prompt-builder.js';
import { generateBeatSheet } from '../src/script/beat-sheet.js';
import type { ShotSpec, VideoCharacterContext, CharacterVisualProfile } from '@suro-buya/shared';

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

const mockVisualProfile: Omit<CharacterVisualProfile, 'characterId'> = {
  referenceImages: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
  styleTags: ['2D', 'watercolor', 'vibrant'],
  colorPalette: ['#3B82F6', '#F59E0B'],
  negativePrompt: 'realistic photo, 3D render',
};

const mockScript = `[Beat 1: Hook]
[Suro berenang menyusuri terumbu karang yang berwarna-warni]
SURO: "Wow, lihat itu! Ada cahaya emas di dasar laut!"

[Beat 2: Conflict]
[Tiba-tiba hiu besar muncul dari kegelapan]
SURO: "A-aku takut... tapi aku harus berani!"

[Beat 3: Punchline]
[Ternyata cahaya emas itu cuma kerang yang memantulkan sinar matahari]
SURO: "Haha, ternyata bukan harta karun!"`;

// ============================================================
// scene-breakdown tests
// ============================================================

describe('scene-breakdown — breakDownScript', () => {
  it('should break down script into shots', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: mockScript,
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);

    expect(result.shots.length).toBeGreaterThan(0);
    expect(result.totalShots).toBe(result.shots.length);
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('should cover all beats from beat sheet', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: mockScript,
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    expect(result.beatsCovered).toBe(beatSheet.totalBeats);
  });

  it('should extract dialogue from script', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: mockScript,
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    const shotsWithDialogue = result.shots.filter(s => s.dialogue);
    expect(shotsWithDialogue.length).toBeGreaterThan(0);
    expect(shotsWithDialogue[0].dialogue?.characterId).toBe(mockCharacter.id);
    expect(shotsWithDialogue[0].dialogue?.line).toContain('Wow');
  });

  it('should assign camera angles to shots', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: mockScript,
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    for (const shot of result.shots) {
      expect(shot.cameraAngle).toBeTruthy();
      expect(shot.cameraAngle.length).toBeGreaterThan(0);
    }
  });

  it('should assign durations to shots', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: mockScript,
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    for (const shot of result.shots) {
      expect(shot.duration).toBeGreaterThan(0);
    }
  });

  it('should build visual prompts for shots', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: mockScript,
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    for (const shot of result.shots) {
      expect(shot.visualPrompt).toBeTruthy();
      expect(shot.visualPrompt).toContain('Suro');
    }
  });

  it('should warn when beats are missing from script', () => {
    const beatSheet = generateBeatSheet(30); // 5 beats
    const input: SceneBreakdownInput = {
      script: 'Short script without beat markers.',
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle script without beat markers', () => {
    const beatSheet = generateBeatSheet(15);
    const input: SceneBreakdownInput = {
      script: 'Suro berenang di laut. SURO: "Halo!" Suro menemukan harta.',
      beatSheet,
      character: mockCharacter,
    };

    const result = breakDownScript(input);
    expect(result.shots.length).toBeGreaterThan(0);
  });
});

// ============================================================
// prompt-builder tests
// ============================================================

const mockShot: ShotSpec = {
  index: 0,
  cameraAngle: 'close-up',
  duration: 4,
  dialogue: { characterId: 'char-001', line: 'Halo teman!' },
  action: 'Suro berenang menyusuri terumbu karang',
  visualPrompt: 'Suro berenang. Character: Suro (hiu kecil biru).',
  motionPrompt: 'slow zoom in',
};

describe('prompt-builder — buildVisualPrompt', () => {
  it('should build visual prompt with all components', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
      visualProfile: mockVisualProfile,
      artStyle: '2D digital, watercolor style',
    };

    const prompt = buildVisualPrompt(input);

    expect(prompt).toContain('close-up');
    expect(prompt).toContain('Suro berenang');
    expect(prompt).toContain('2D digital, watercolor style');
    expect(prompt).toContain('watercolor');
    expect(prompt).toContain('#3B82F6');
    expect(prompt).toContain('reference image');
    expect(prompt).toContain('9:16');
  });

  it('should work without visual profile', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
    };

    const prompt = buildVisualPrompt(input);
    expect(prompt).toContain('close-up');
    expect(prompt).toContain('Suro berenang');
    expect(prompt).toContain('Art style:');
  });

  it('should use default art style when not provided', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
    };

    const prompt = buildVisualPrompt(input);
    expect(prompt).toContain('2D digital illustration');
  });
});

describe('prompt-builder — buildMotionPrompt', () => {
  it('should use shot motionPrompt when available', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
    };

    const prompt = buildMotionPrompt(input);
    expect(prompt).toContain('slow zoom in');
    expect(prompt).toContain('4s');
    expect(prompt).toContain('close-up');
  });

  it('should generate default motion based on camera angle', () => {
    const shot: ShotSpec = {
      ...mockShot,
      motionPrompt: undefined,
      cameraAngle: 'wide shot',
    };

    const input: PromptBuilderInput = { shot };
    const prompt = buildMotionPrompt(input);

    expect(prompt).toContain('environmental movement');
    expect(prompt).toContain('4s');
    expect(prompt).toContain('wide shot');
  });

  it('should generate default motion for close-up', () => {
    const shot: ShotSpec = {
      ...mockShot,
      motionPrompt: undefined,
      cameraAngle: 'close-up',
    };

    const input: PromptBuilderInput = { shot };
    const prompt = buildMotionPrompt(input);

    expect(prompt).toContain('subtle character movement');
  });
});

describe('prompt-builder — buildNegativePrompt', () => {
  it('should include default negatives', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
    };

    const prompt = buildNegativePrompt(input);
    expect(prompt).toContain('blurry');
    expect(prompt).toContain('low quality');
    expect(prompt).toContain('horizontal format');
  });

  it('should include visual profile negative prompt', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
      visualProfile: mockVisualProfile,
    };

    const prompt = buildNegativePrompt(input);
    expect(prompt).toContain('realistic photo');
    expect(prompt).toContain('3D render');
  });
});

describe('prompt-builder — buildAllPrompts', () => {
  it('should return all three prompts', () => {
    const input: PromptBuilderInput = {
      shot: mockShot,
      visualProfile: mockVisualProfile,
      artStyle: '2D digital',
    };

    const result = buildAllPrompts(input);

    expect(result.visualPrompt).toBeTruthy();
    expect(result.motionPrompt).toBeTruthy();
    expect(result.negativePrompt).toBeTruthy();
  });
});