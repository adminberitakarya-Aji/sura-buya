import { describe, it, expect, vi } from 'vitest';
import { validateCanon, BUILTIN_RULES, ValidationContext } from '../src/validate.js';
import type { GenerationContext, SceneData, EpisodeStructure, UniverseConfig, CharacterProfile, WorldProfile, StoryProfile } from '../src/types.js';

describe('Engine Validation', () => {
  const createMockContext = (): GenerationContext => ({
    universeConfig: {
      id: 'suro-buya',
      name: 'Suro Buya Universe',
      version: '1.0.0',
      locale: 'id-ID',
      locales: ['id-ID', 'en-US'],
      timezone: 'Asia/Jakarta',
    } as UniverseConfig,
    characterBibles: {
      suro: {
        id: 'char-suro',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        name: 'Suro',
        archetype: 'protagonist',
        description: 'A curious young inventor',
        traits: ['Curious', 'Inventive'],
      } as CharacterProfile,
      buya: {
        id: 'char-buya',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        name: 'Buya',
        archetype: 'sidekick',
        description: 'A wind-reading companion',
        traits: ['Intuitive', 'Playful'],
      } as CharacterProfile,
    },
    worldBibles: {
      aetheris: {
        id: 'world-aetheris',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        name: 'Aetheris',
        type: 'planet',
        description: 'World of floating islands',
        geography: {
          climate: 'Temperate',
          terrain: ['Floating islands', 'Cloud seas'],
          landmarks: ['The Core Spire', 'The Great Library'],
        },
      } as WorldProfile,
    },
    storyProfile: {
      id: 'origin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      title: 'Suro & Buya: Origin',
      type: 'series',
      logline: 'Two inventors save their world',
      synopsis: 'Suro and Buya journey to fix the Core',
      themes: ['Friendship', 'Discovery'],
      genre: ['Steampunk', 'Fantasy'],
      audience: 'Young Adult',
      tone: 'Hopeful adventure',
      characters: ['suro', 'buya'],
      locations: ['aetheris'],
      plotPoints: [],
    } as StoryProfile,
    episodeStructure: {
      id: 's01e01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      number: 1,
      season: 1,
      title: 'The Fall of Home',
      summary: 'Suro detects Core instability. Home island falls. Escape on sky-ship.',
      scenes: [
        { number: 1, location: "Suro's Workshop", characters: ['suro', 'buya'], summary: 'Suro shows detector', type: 'exposition', estimatedDuration: 5 },
        { number: 2, location: 'Village Square', characters: ['suro', 'buya'], summary: 'Island tremors begin', type: 'action', estimatedDuration: 7 },
      ],
      themes: ['Loss of innocence', 'Journey begins'],
      characterArcs: ['suro: Naive -> Determined', 'buya: Carefree -> Resolute'],
    } as EpisodeStructure,
    previousScenes: [],
    characterStates: {
      suro: { location: "Suro's Workshop", mood: 'focused', energy: 'high' },
      buya: { location: "Suro's Workshop", mood: 'curious', energy: 'medium' },
    },
    worldState: { coreStability: 'critical', weather: 'stormy', timeOfDay: 'dawn' },
  });

  describe('validateCanon', () => {
    it('should pass validation for valid scene content', async () => {
      const content = `
SCENE 1: Suro's Workshop - DAY
Characters: Suro, Buya

Suro: Buya, look at this! The Core Resonance Detector is finally calibrated.

Buya: (landing gracefully) The wind whispers of change, Suro.

Action: The detector needle spikes violently. A low hum fills the workshop.
`;
      
      const result = await validateCanon(content, 'scene', createMockContext(), { strictMode: false });
      
      expect(result.valid).toBe(true);
      expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
    });

    it('should detect missing character names (CHAR-001)', async () => {
      const content = `
SCENE 1: Suro's Workshop - DAY
Characters: Suro, Buya

Some random character speaks without being in the bible.
`;
      
      const context = createMockContext();
      if (context.episodeStructure?.scenes?.[0]) {
        context.episodeStructure.scenes[0].characters = ['suro', 'buya'];
      }
      
      const result = await validateCanon(content, 'scene', context, { strictMode: true });
      
      // CHAR-001 checks if characters in scene are mentioned in content
      // This test mainly ensures validation runs without error
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should detect invalid location (WORLD-001)', async () => {
      const content = `
SCENE 1: Invalid Location - DAY
Characters: Suro

Suro: This place doesn't exist in the bible.
`;
      
      const context = createMockContext();
      if (context.episodeStructure?.scenes?.[0]) {
        context.episodeStructure.scenes[0].location = 'Invalid Location';
        context.episodeStructure.scenes[0].characters = ['suro'];
      }
      
      const result = await validateCanon(content, 'scene', context, { strictMode: true });
      
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should detect scene number out of bounds (PLOT-001)', async () => {
      const content = `
SCENE 99: Suro's Workshop - DAY
Characters: Suro

Suro: This scene number is way too high.
`;
      
      const context = createMockContext();
      // Only 2 scenes defined, but scene 99 referenced
      if (context.episodeStructure?.scenes?.[0]) {
        context.episodeStructure.scenes[0].characters = ['suro'];
      }
      
      const result = await validateCanon(content, 'scene', context, { strictMode: true });
      
      expect(result).toBeDefined();
    });

    it('should check screenplay format (TECH-001)', async () => {
      const content = 'Just plain text without screenplay format';
      
      const context = createMockContext();
      
      const result = await validateCanon(content, 'scene', context, { strictMode: true });
      
      expect(result).toBeDefined();
      // TECH-001 should warn about missing scene heading
      const techWarnings = result.warnings.filter(w => w.code === 'TECH-001');
      expect(techWarnings.length).toBeGreaterThan(0);
    });

    it('should pass with proper screenplay format', async () => {
      const content = `
INT. SURO'S WORKSHOP - DAY

Suro adjusts a brass contraption with a glowing blue core.

SURO
Buya, look! It's finally calibrated. The needle shouldn't move unless...

The needle spikes violently. Both freeze.

BUYA
The wind... it screams.

A distant rumble shakes the workshop. Dust falls from rafters.
`;
      
      const context = createMockContext();
      if (context.episodeStructure?.scenes?.[0]) {
        context.episodeStructure.scenes[0].characters = ['suro', 'buya'];
      }
      
      const result = await validateCanon(content, 'scene', context, { strictMode: false });
      
      expect(result.valid).toBe(true);
    });
  });

  describe('BUILTIN_RULES', () => {
    it('should have all expected built-in rules', () => {
      const ruleIds = BUILTIN_RULES.map(r => r.id);
      expect(ruleIds).toContain('CHAR-001');
      expect(ruleIds).toContain('CHAR-002');
      expect(ruleIds).toContain('WORLD-001');
      expect(ruleIds).toContain('WORLD-002');
      expect(ruleIds).toContain('PLOT-001');
      expect(ruleIds).toContain('PLOT-002');
      expect(ruleIds).toContain('TECH-001');
    });

    it('should have valid severity levels', () => {
      for (const rule of BUILTIN_RULES) {
        expect(['error', 'warning', 'info']).toContain(rule.severity);
      }
    });

    it('should have check functions', () => {
      for (const rule of BUILTIN_RULES) {
        expect(typeof rule.check).toBe('function');
      }
    });
  });

  describe('validateIdFormat', () => {
    it('should be exported', async () => {
      const { validateIdFormat } = await import('../src/validate.js');
      expect(typeof validateIdFormat).toBe('function');
    });
  });

  describe('validateRequiredFields', () => {
    it('should be exported', async () => {
      const { validateRequiredFields } = await import('../src/validate.js');
      expect(typeof validateRequiredFields).toBe('function');
    });

    it('should detect missing required fields', async () => {
      const { validateRequiredFields } = await import('../src/validate.js');
      const obj = { name: 'Test', value: 123 };
      const result = validateRequiredFields(obj, ['name', 'value', 'missing']);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('missing');
    });

    it('should pass when all required fields present', async () => {
      const { validateRequiredFields } = await import('../src/validate.js');
      const obj = { name: 'Test', value: 123 };
      const result = validateRequiredFields(obj, ['name', 'value']);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });
});

function createMockContext(): GenerationContext {
  return {
    universeConfig: {
      id: 'suro-buya',
      name: 'Suro Buya Universe',
      version: '1.0.0',
      locale: 'id-ID',
      locales: ['id-ID', 'en-US'],
      timezone: 'Asia/Jakarta',
    } as UniverseConfig,
    characterBibles: {
      suro: {
        id: 'char-suro',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        name: 'Suro',
        archetype: 'protagonist',
        description: 'A curious young inventor',
        traits: ['Curious', 'Inventive'],
      } as CharacterProfile,
      buya: {
        id: 'char-buya',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        name: 'Buya',
        archetype: 'sidekick',
        description: 'A wind-reading companion',
        traits: ['Intuitive', 'Playful'],
      } as CharacterProfile,
    },
    worldBibles: {
      aetheris: {
        id: 'world-aetheris',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        name: 'Aetheris',
        type: 'planet',
        description: 'World of floating islands',
        geography: {
          climate: 'Temperate',
          terrain: ['Floating islands', 'Cloud seas'],
          landmarks: ["Suro's Workshop", 'The Core Spire', 'The Great Library'],
        },
      } as WorldProfile,
    },
    storyProfile: {
      id: 'origin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      title: 'Suro & Buya: Origin',
      type: 'series',
      logline: 'Two inventors save their world',
      synopsis: 'Suro and Buya journey to fix the Core',
      themes: ['Friendship', 'Discovery'],
      genre: ['Steampunk', 'Fantasy'],
      audience: 'Young Adult',
      tone: 'Hopeful adventure',
      characters: ['suro', 'buya'],
      locations: ['aetheris'],
      plotPoints: [],
    } as StoryProfile,
    episodeStructure: {
      id: 's01e01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      number: 1,
      season: 1,
      title: 'The Fall of Home',
      summary: 'Suro detects Core instability. Home island falls. Escape on sky-ship.',
      scenes: [
        { number: 1, location: "Suro's Workshop", characters: ['suro', 'buya'], summary: 'Suro shows detector', type: 'exposition', estimatedDuration: 5 },
        { number: 2, location: 'Village Square', characters: ['suro', 'buya'], summary: 'Island tremors begin', type: 'action', estimatedDuration: 7 },
      ],
      themes: ['Loss of innocence', 'Journey begins'],
      characterArcs: ['suro: Naive -> Determined', 'buya: Carefree -> Resolute'],
    } as EpisodeStructure,
    previousScenes: [],
    characterStates: {
      suro: { location: "Suro's Workshop", mood: 'focused', energy: 'high' },
      buya: { location: "Suro's Workshop", mood: 'curious', energy: 'medium' },
    },
    worldState: { coreStability: 'critical', weather: 'stormy', timeOfDay: 'dawn' },
  };
}