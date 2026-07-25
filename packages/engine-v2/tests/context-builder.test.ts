/**
 * Suro-Buya Engine v2 - Context Builder Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextBuilder, createContextBuilder, DEFAULT_CONTEXT_CONFIG } from '../src/bible/context-builder.js';
import { BibleLoader, createBibleLoader } from '../src/bible/loader.js';
import { BibleIndexer, createBibleIndexer } from '../src/bible/indexer.js';
import type { GenerationContext, SceneGenerationInput, EpisodeGenerationInput, CharacterProfile, WorldProfile, StoryProfile, EpisodeStructure, SceneData } from '../src/types.js';
import type { BibleFile, BibleKey, TokenBudget } from '../src/bible/types.js';
import { BibleIndexer as BibleIndexerClass, IndexedSection } from '../src/bible/indexer.js';

// Mock bible loader
const createMockLoader = (files: BibleFile[]): BibleLoader => {
  const mockLoader = {
    load: vi.fn(async (key: BibleKey) => files.find(f => f.key === key) || null),
    loadAll: vi.fn(async (keys: BibleKey[]) => files.filter(f => keys.includes(f.key))),
    loadUniverse: vi.fn(async () => files),
    getIndex: vi.fn(async () => ({
      universeId: 'test',
      files: new Map(),
      characterIds: ['suro', 'buya'],
      regionIds: ['aetheris'],
      totalTokens: files.reduce((sum, f) => sum + f.tokens, 0),
    })),
    clearCache: vi.fn(),
    invalidate: vi.fn(),
  } as unknown as BibleLoader;
  
  return mockLoader;
};

// Mock bible indexer
const createMockIndexer = (): BibleIndexer => {
  return {
    index: vi.fn(async () => {}),
    search: vi.fn(() => []),
    getIndex: vi.fn(() => ({ sections: [], metadata: {} })),
    rebuild: vi.fn(async () => {}),
  } as unknown as BibleIndexer;
};

// Test data
const createMockContext = (): GenerationContext => ({
  universeConfig: {
    id: 'test-universe',
    name: 'Test Universe',
    version: '1.0.0',
    locale: 'en-US',
    locales: ['en-US'],
    timezone: 'UTC',
  },
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
      voice: {
        tone: 'enthusiastic',
        vocabulary: ['gear', 'steam', 'mechanism'],
        speechPatterns: ['technical'],
        catchphrases: ['Fascinating!'],
      },
      relationships: {},
      arc: {
        start: 'Naive inventor',
        middle: 'Determined hero',
        end: 'Master of steam technology',
      },
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
      voice: {
        tone: 'mystical',
        vocabulary: ['wind', 'breeze', 'current'],
        speechPatterns: ['poetic'],
        catchphrases: ['The wind whispers...'],
      },
      relationships: {},
      arc: {
        start: 'Carefree spirit',
        middle: 'Resolute companion',
        end: 'Guardian of the winds',
      },
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
      culture: {
        language: ['Aetherian'],
        customs: ['Wind reading', 'Steam crafting'],
        beliefs: ['The Core sustains all'],
        socialStructure: 'Meritocratic guilds',
      },
      history: {
        timeline: [],
        keyEvents: ['The Great Separation', 'Core Stabilization'],
      },
      connections: [],
    } as WorldProfile,
  },
  storyProfile: {
    id: 'origin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    title: 'Test Story',
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

const createMockSceneInput = (): SceneGenerationInput => ({
  universeId: 'test-universe',
  episodeId: 's01e01',
  sceneNumber: 1,
  location: "Suro's Workshop",
  timeOfDay: 'dawn',
  characters: ['suro', 'buya'],
  type: 'exposition',
  estimatedDuration: 5,
  keyBeats: ['Suro calibrates detector', 'Buya senses disturbance'],
  previousSceneSummary: undefined,
  specialInstructions: 'Focus on technical details',
});

const createMockEpisodeInput = (): EpisodeGenerationInput => ({
  universeId: 'test-universe',
  seasonNumber: 1,
  episodeNumber: 1,
  title: 'The Fall of Home',
  storyArc: 'origin',
  focusCharacters: ['suro', 'buya'],
  keyPlotPoints: ['Core instability detected', 'Home island falls', 'Escape begins'],
  themes: ['Friendship', 'Discovery'],
  targetRuntime: 22,
  sceneCount: 6,
});

describe('ContextBuilder', () => {
  let mockLoader: BibleLoader;
  let mockIndexer: BibleIndexer;
  let contextBuilder: ContextBuilder;
  let mockContext: GenerationContext;
  let mockFiles: BibleFile[];
  
  beforeEach(() => {
    mockFiles = [
      {
        key: 'canonRules',
        relPath: 'bible/01-character-bible/canon-rules.md',
        content: '# Canon Rules\n1. No magic\n2. Steam power only\n3. Characters must stay in character',
        tokens: 25,
        lastModified: new Date(),
      },
      {
        key: 'voiceGuide',
        relPath: 'bible/01-character-bible/voice-guide.md',
        content: '# Voice Guide\nSuro: Technical, uses gear/steam/mechanism\nBuya: Poetic, uses wind/breeze/current',
        tokens: 30,
        lastModified: new Date(),
      },
      {
        key: 'episodeFormula',
        relPath: 'bible/03-story-bible/episode-formula.md',
        content: '# Episode Formula\n3 acts, 6 scenes per episode\nAct 1: Setup (2 scenes)\nAct 2: Confrontation (2 scenes)\nAct 3: Resolution (2 scenes)',
        tokens: 40,
        lastModified: new Date(),
      },
      {
        key: 'character:suro',
        relPath: 'bible/01-character-bible/suro.md',
        content: '# Suro\nA curious young inventor who loves steam technology',
        tokens: 20,
        lastModified: new Date(),
      },
      {
        key: 'character:buya',
        relPath: 'bible/01-character-bible/buya.md',
        content: '# Buya\nA wind-reading companion who speaks poetically',
        tokens: 18,
        lastModified: new Date(),
      },
      {
        key: 'characterOverview',
        relPath: 'bible/01-character-bible/overview.md',
        content: '# Character Overview\nMain characters: Suro (protagonist), Buya (sidekick)',
        tokens: 15,
        lastModified: new Date(),
      },
      {
        key: 'relationshipDynamic',
        relPath: 'bible/01-character-bible/relationships.md',
        content: '# Relationships\nSuro <-> Buya: Partners, complementary skills',
        tokens: 12,
        lastModified: new Date(),
      },
    ];
    
    mockLoader = createMockLoader(mockFiles);
    mockIndexer = createMockIndexer();
    contextBuilder = createContextBuilder(mockLoader, mockIndexer);
    mockContext = createMockContext();
  });
  
  describe('buildSceneContext()', () => {
    it('should build context for scene generation', async () => {
      const input = createMockSceneInput();
      const result = await contextBuilder.buildSceneContext(input, mockContext);
      
      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('Test Universe');
      expect(result.systemPrompt).toContain('TASK: SCENE');
      expect(result.userPrompt).toContain('SCENE SPECIFICATIONS');
      expect(result.userPrompt).toContain("Suro's Workshop");
      expect(result.userPrompt).toContain('dawn');
      expect(result.userPrompt).toContain('exposition');
      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.contextFiles.length).toBeGreaterThan(0);
    });
    
    it('should include canon rules in system prompt', async () => {
      const input = createMockSceneInput();
      const result = await contextBuilder.buildSceneContext(input, mockContext);
      
      expect(result.systemPrompt).toContain('CANON RULES (MANDATORY)');
      expect(result.systemPrompt).toContain('Character Consistency');
      expect(result.systemPrompt).toContain('World Consistency');
    });
    
    it('should include character bibles for requested characters', async () => {
      const input = createMockSceneInput();
      const result = await contextBuilder.buildSceneContext(input, mockContext);
      
      // Should include character sections in user prompt
      expect(result.userPrompt).toContain('CHARACTER');
      expect(result.contextFiles.some(f => f.key === 'character:suro')).toBe(true);
      expect(result.contextFiles.some(f => f.key === 'character:buya')).toBe(true);
    });
    
    it('should include episode context when available', async () => {
      const input = createMockSceneInput();
      const result = await contextBuilder.buildSceneContext(input, mockContext);
      
      expect(result.userPrompt).toContain('EPISODE CONTEXT');
      expect(result.userPrompt).toContain('The Fall of Home');
    });
    
    it('should respect token budget', async () => {
      const input = createMockSceneInput();
      const budget: TokenBudget = {
        bibleContext: 50,
        total: 2000,
        systemPrompt: 500,
        taskPrompt: 500,
        response: 900,
        margin: 50,
      }; // Very small budget
      const result = await contextBuilder.buildSceneContext(input, mockContext, budget);
      
      // Should still work but may have warnings
      expect(result).toBeDefined();
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });
    
    it('should include previous scenes when configured', async () => {
      const input = createMockSceneInput();
      const contextWithPrevious = {
        ...mockContext,
        previousScenes: [
          {
            id: 'prev-1',
            episodeId: 's01e01',
            number: 0,
            location: 'Prologue',
            timeOfDay: 'night',
            type: 'exposition',
            characters: ['suro'],
            estimatedDuration: 3,
            beats: [{ order: 1, description: 'Prologue scene' }],
            visualNotes: '',
            audioNotes: '',
            content: 'Prologue content',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          } as SceneData,
        ],
      };
      
      const result = await contextBuilder.buildSceneContext(input, contextWithPrevious);
      
      expect(result.userPrompt).toContain('PREVIOUS SCENES');
    });
  });
  
  describe('buildEpisodeContext()', () => {
    it('should build context for episode generation', async () => {
      const input = createMockEpisodeInput();
      const result = await contextBuilder.buildEpisodeContext(input, mockContext);
      
      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('Test Universe');
      expect(result.systemPrompt).toContain('TASK: EPISODE');
      expect(result.userPrompt).toContain('EPISODE SPECIFICATIONS');
      expect(result.userPrompt).toContain('season: 1');
      expect(result.userPrompt).toContain('episode: 1');
    });
    
    it('should include season context', async () => {
      const input = createMockEpisodeInput();
      const result = await contextBuilder.buildEpisodeContext(input, mockContext);
      
      expect(result.userPrompt).toContain('SEASON CONTEXT');
      expect(result.userPrompt).toContain('**Season:** 1');
    });
  });
  
  describe('buildValidationContext()', () => {
    it('should build context for validation', async () => {
      const content = 'SCENE 1: Test\n\nSuro: Hello world';
      const result = await contextBuilder.buildValidationContext(content, 'scene', mockContext);
      
      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('VALIDATION');
      expect(result.userPrompt).toContain('CONTENT TO VALIDATE');
      expect(result.userPrompt).toContain(content);
    });
  });
  
  describe('DEFAULT_CONTEXT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CONTEXT_CONFIG.maxBibleTokens).toBe(4000);
      expect(DEFAULT_CONTEXT_CONFIG.includeCharacterBibles).toBe(true);
      expect(DEFAULT_CONTEXT_CONFIG.includeWorldBibles).toBe(true);
      expect(DEFAULT_CONTEXT_CONFIG.includeStoryBible).toBe(true);
      expect(DEFAULT_CONTEXT_CONFIG.includeEpisodeStructure).toBe(true);
      expect(DEFAULT_CONTEXT_CONFIG.includePreviousScenes).toBe(3);
    });
  });
  
  describe('Token estimation', () => {
    it('should estimate tokens roughly correctly', async () => {
      const input = createMockSceneInput();
      const result = await contextBuilder.buildSceneContext(input, mockContext);
      
      // Token estimation: ~4 chars per token
      const expectedMinTokens = (result.systemPrompt.length + result.userPrompt.length) / 4;
      expect(result.estimatedTokens).toBeGreaterThanOrEqual(expectedMinTokens * 0.5); // Within factor of 2
    });
  });
});

describe('ContextBuilder - Edge cases', () => {
  let mockLoader: BibleLoader;
  let mockIndexer: BibleIndexer;
  let contextBuilder: ContextBuilder;
  let mockContext: GenerationContext;
  
  beforeEach(() => {
    mockLoader = createMockLoader([]);
    mockIndexer = createMockIndexer();
    contextBuilder = createContextBuilder(mockLoader, mockIndexer);
    mockContext = createMockContext();
  });
  
  it('should handle missing bible files gracefully', async () => {
    const input = createMockSceneInput();
    const result = await contextBuilder.buildSceneContext(input, mockContext);
    
    expect(result).toBeDefined();
    expect(result.systemPrompt).toBeDefined();
    expect(result.userPrompt).toBeDefined();
  });
  
  it('should handle empty character list', async () => {
    const input = { ...createMockSceneInput(), characters: [] };
    const result = await contextBuilder.buildSceneContext(input, mockContext);
    
    expect(result).toBeDefined();
    expect(result.userPrompt).toContain('characters:');
  });
  
  it('should handle missing episode structure', async () => {
    const input = createMockSceneInput();
    const contextWithoutEpisode = {
      ...mockContext,
      episodeStructure: undefined as any,
    };
    
    const result = await contextBuilder.buildSceneContext(input, contextWithoutEpisode);
    
    expect(result).toBeDefined();
    // Should not crash, just not include episode context
  });
  
  it('should handle config overrides', async () => {
    const customBuilder = createContextBuilder(mockLoader, mockIndexer, {
      includeCharacterBibles: false,
      includeWorldBibles: false,
      includeStoryBible: false,
      includeEpisodeStructure: false,
      includePreviousScenes: 0,
    });
    
    const input = createMockSceneInput();
    const result = await customBuilder.buildSceneContext(input, mockContext);
    
    expect(result).toBeDefined();
    // Should still have system prompt but minimal bible context
  });
});
