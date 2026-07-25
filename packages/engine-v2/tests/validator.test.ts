/**
 * Suro-Buya Engine v2 - Canon Validator Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  RuleEngine, 
  CanonRule, 
  createDefaultRuleEngine,
  LLMJudge,
  CanonValidator,
  DEFAULT_JUDGING_CRITERIA,
  createDefaultLLMJudge,
  createDefaultCanonValidator,
} from '../src/validate/canon.js';
import type { 
  GenerationContext, 
  CharacterProfile, 
  WorldProfile, 
  StoryProfile, 
  EpisodeStructure, 
  SceneData,
  UniverseConfig,
  ValidationContext,
  ValidationViolation,
  CanonValidationResult,
} from '../src/types.js';

// Mock AI Provider
const createMockProvider = () => ({
  name: 'test-provider',
  version: '1.0.0',
  generate: vi.fn(async (prompt: string, options: any) => ({
    content: JSON.stringify({
      scores: { characterConsistency: 0.9, worldConsistency: 0.85 },
      violations: [],
      overallScore: 0.87,
      summary: 'Content looks consistent with canon',
    }),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    finishReason: 'stop' as const,
    model: 'test-model',
    provider: 'test-provider',
    latency: 100,
  })),
  generateStream: vi.fn(async function* () { yield ''; }),
  isAvailable: vi.fn(async () => true),
  getModels: vi.fn(async () => ['test-model']),
});

// Test data
const createMockUniverseConfig = (): UniverseConfig => ({
  id: 'test-universe',
  name: 'Test Universe',
  version: '1.0.0',
  locale: 'en-US',
  locales: ['en-US'],
  timezone: 'UTC',
});

const createMockCharacters = (): Record<string, CharacterProfile> => ({
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
  },
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
  },
});

const createMockWorlds = (): Record<string, WorldProfile> => ({
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
  },
});

const createMockStory = (): StoryProfile => ({
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
});

const createMockEpisode = (): EpisodeStructure => ({
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
});

const createMockScene = (): SceneData => ({
  id: 'scene-1',
  episodeId: 's01e01',
  number: 1,
  location: "Suro's Workshop",
  timeOfDay: 'dawn',
  characters: ['suro', 'buya'],
  type: 'exposition',
  estimatedDuration: 5,
  beats: [
    { order: 1, description: 'Suro calibrates detector' },
    { order: 2, description: 'Buya senses disturbance' },
  ],
  visualNotes: '',
  audioNotes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
});

const createMockContext = (): GenerationContext => ({
  universeConfig: createMockUniverseConfig(),
  characterBibles: createMockCharacters(),
  worldBibles: createMockWorlds(),
  storyProfile: createMockStory(),
  episodeStructure: createMockEpisode(),
  previousScenes: [],
  characterStates: {
    suro: { location: "Suro's Workshop", mood: 'focused', energy: 'high' },
    buya: { location: "Suro's Workshop", mood: 'curious', energy: 'medium' },
  },
  worldState: { coreStability: 'critical', weather: 'stormy', timeOfDay: 'dawn' },
});

const createValidationContext = (overrides: Partial<ValidationContext> = {}): ValidationContext => ({
  content: 'Test content',
  contentType: 'scene',
  universeConfig: createMockUniverseConfig(),
  characterBibles: createMockCharacters(),
  worldBibles: createMockWorlds(),
  storyProfile: createMockStory(),
  episodeStructure: createMockEpisode(),
  sceneData: createMockScene(),
  characterProfile: createMockCharacters()['suro'],
  worldProfile: createMockWorlds()['aetheris'],
  ...overrides,
});

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;
  
  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });
  
  it('should create empty rule engine', () => {
    expect(ruleEngine).toBeInstanceOf(RuleEngine);
    expect(ruleEngine.getRules()).toHaveLength(0);
  });
  
  it('should add and retrieve rules', () => {
    const rule: CanonRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'A test rule',
      severity: 'error',
      check: () => [],
    };
    
    ruleEngine.addRule(rule);
    expect(ruleEngine.getRules()).toHaveLength(1);
    const rules = ruleEngine.getRules();
    expect(rules[0]!.id).toBe('test-rule');
  });
  
  it('should remove rules', () => {
    const rule: CanonRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'A test rule',
      severity: 'error',
      check: () => [],
    };
    
    ruleEngine.addRule(rule);
    expect(ruleEngine.removeRule('test-rule')).toBe(true);
    expect(ruleEngine.getRules()).toHaveLength(0);
    expect(ruleEngine.removeRule('non-existent')).toBe(false);
  });
  
  it('should validate with no rules', () => {
    const context = createValidationContext();
    const violations = ruleEngine.validate(context);
    expect(violations).toHaveLength(0);
  });
  
  it('should run rules and collect violations', () => {
    const rule: CanonRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'A test rule',
      severity: 'error',
      check: (context) => [{
        rule: 'test-rule',
        severity: 'error',
        location: 'test',
        expected: 'valid',
        actual: 'invalid',
      }],
    };
    
    ruleEngine.addRule(rule);
    const context = createValidationContext();
    const violations = ruleEngine.validate(context);
    
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('test-rule');
    expect(violations[0]!.severity).toBe('error');
  });
  
  it('should handle rule errors gracefully', () => {
    const rule: CanonRule = {
      id: 'error-rule',
      name: 'Error Rule',
      description: 'A rule that throws',
      severity: 'error',
      check: () => { throw new Error('Rule failed'); },
    };
    
    ruleEngine.addRule(rule);
    const context = createValidationContext();
    const violations = ruleEngine.validate(context);
    
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('error-rule');
    expect(violations[0]!.actual).toContain('Rule failed');
  });
  
  it('should run multiple rules', () => {
    const rule1: CanonRule = {
      id: 'rule-1',
      name: 'Rule 1',
      description: 'First rule',
      severity: 'error',
      check: () => [{
        rule: 'rule-1',
        severity: 'error',
        location: 'test',
        expected: 'valid',
        actual: 'invalid',
      }],
    };
    
    const rule2: CanonRule = {
      id: 'rule-2',
      name: 'Rule 2',
      description: 'Second rule',
      severity: 'warning',
      check: () => [{
        rule: 'rule-2',
        severity: 'warning',
        location: 'test',
        expected: 'valid',
        actual: 'warning case',
      }],
    };
    
    ruleEngine.addRule(rule1);
    ruleEngine.addRule(rule2);
    
    const context = createValidationContext();
    const violations = ruleEngine.validate(context);
    
    expect(violations).toHaveLength(2);
    expect(violations[0]!.severity).toBe('error');
    expect(violations[1]!.severity).toBe('warning');
  });
});

describe('createDefaultRuleEngine', () => {
  it('should create engine with default rules', () => {
    const engine = createDefaultRuleEngine();
    const rules = engine.getRules();
    
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some(r => r.id === 'character-name-consistency')).toBe(true);
    expect(rules.some(r => r.id === 'location-consistency')).toBe(true);
    expect(rules.some(r => r.id === 'dialogue-character-voice')).toBe(true);
    expect(rules.some(r => r.id === 'scene-timeline-consistency')).toBe(true);
    expect(rules.some(r => r.id === 'forbidden-content')).toBe(true);
  });
  
  it('should detect unknown characters', () => {
    const engine = createDefaultRuleEngine();
    const context = createValidationContext({
      sceneData: {
        ...createMockScene(),
        characters: ['suro', 'buya', 'unknown-character'],
      },
    });
    
    const violations = engine.validate(context);
    const charViolations = violations.filter(v => v.rule === 'character-name-consistency');
    
    expect(charViolations.length).toBeGreaterThan(0);
    expect(charViolations[0]!.actual).toContain('unknown-character');
  });
  
  it('should not flag known characters', () => {
    const engine = createDefaultRuleEngine();
    const context = createValidationContext({
      sceneData: createMockScene(),
    });
    
    const violations = engine.validate(context);
    const charViolations = violations.filter(v => v.rule === 'character-name-consistency');
    
    expect(charViolations).toHaveLength(0);
  });
  
  it('should check location consistency', () => {
    const engine = createDefaultRuleEngine();
    const baseWorlds = createMockWorlds();
    const context = createValidationContext({
      sceneData: {
        ...createMockScene(),
        location: 'Unknown Location',
      },
      worldBibles: {
        ...baseWorlds,
        aetheris: {
          ...baseWorlds['aetheris']!,
          locations: [
            { name: 'Suro Workshop', description: 'Suro\'s workshop' },
            { name: 'Village Square', description: 'Main village square' },
            { name: 'Core Spire', description: 'The central spire' },
          ],
        } as any, // ExtendedWorldProfile includes locations
      },
    });
    
    const violations = engine.validate(context);
    const locViolations = violations.filter(v => v.rule === 'location-consistency');
    
    // Location not in world bible should trigger warning
    expect(locViolations.length).toBeGreaterThan(0);
  });
});

describe('LLMJudge', () => {
  let mockProvider: any;
  let judge: LLMJudge;
  
  beforeEach(() => {
    mockProvider = createMockProvider();
    judge = new LLMJudge(mockProvider, { model: 'test-model', temperature: 0.1 });
  });
  
  it('should create judge instance', () => {
    expect(judge).toBeInstanceOf(LLMJudge);
  });
  
  it('should judge content and return result', async () => {
    const content = 'Suro: Hello\nBuya: The wind blows';
    const context = createValidationContext();
    const criteria = DEFAULT_JUDGING_CRITERIA;
    
    const result = await judge.judge(content, context, criteria);
    
    expect(result).toBeDefined();
    expect(result.scores).toBeDefined();
    expect(result.violations).toBeDefined();
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
    expect(result.summary).toBeDefined();
    expect(mockProvider.generate).toHaveBeenCalled();
  });
  
  it('should handle parsing errors gracefully', async () => {
    mockProvider.generate.mockResolvedValueOnce({
      content: 'Invalid response without JSON',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    
    const content = 'Test content';
    const context = createValidationContext();
    const result = await judge.judge(content, context, DEFAULT_JUDGING_CRITERIA);
    
    expect(result.overallScore).toBe(0);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]!.criterion).toBe('parsing');
  });
  
  it('should extract JSON from response', async () => {
    mockProvider.generate.mockResolvedValueOnce({
      content: 'Here is the result: {"scores": {"test": 0.8}, "violations": [], "overallScore": 0.8, "summary": "Good"} End.',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    
    const content = 'Test content';
    const context = createValidationContext();
    const result = await judge.judge(content, context, DEFAULT_JUDGING_CRITERIA);
    
    expect(result.overallScore).toBe(0.8);
  });
});

describe('CanonValidator', () => {
  let ruleEngine: RuleEngine;
  let validator: CanonValidator;
  
  beforeEach(() => {
    ruleEngine = createDefaultRuleEngine();
    validator = new CanonValidator(ruleEngine);
  });
  
  it('should create validator with rule engine', () => {
    expect(validator).toBeInstanceOf(CanonValidator);
    expect(validator.getRuleEngine()).toBe(ruleEngine);
  });
  
  it('should validate content and return result', async () => {
    const content = 'SCENE 1: Test\n\nSuro: Hello world';
    const context = createValidationContext();
    
    const result = await validator.validate(content, context);
    
    expect(result).toBeDefined();
    expect(result.valid).toBeDefined();
    expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(result.consistencyScore).toBeLessThanOrEqual(1);
    expect(result.violations).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.infos).toBeDefined();
  });
  
  it('should categorize violations by severity', async () => {
    const rule: CanonRule = {
      id: 'test-error',
      name: 'Test Error',
      description: 'Test error rule',
      severity: 'error',
      check: () => [{
        rule: 'test-error',
        severity: 'error',
        location: 'test',
        expected: 'valid',
        actual: 'error case',
      }],
    };
    
    const rule2: CanonRule = {
      id: 'test-warning',
      name: 'Test Warning',
      description: 'Test warning rule',
      severity: 'warning',
      check: () => [{
        rule: 'test-warning',
        severity: 'warning',
        location: 'test',
        expected: 'valid',
        actual: 'warning case',
      }],
    };
    
    const engine = new RuleEngine([rule, rule2]);
    const val = new CanonValidator(engine, undefined, false);
    
    const content = 'Test content';
    const context = createValidationContext();
    const result = await val.validate(content, context);
    
    expect(result.errors.length).toBe(1);
    expect(result.warnings.length).toBe(1);
    expect(result.infos.length).toBe(0);
  });
  
  it('should calculate consistency score', async () => {
    const content = 'Valid content';
    const context = createValidationContext();
    const result = await validator.validate(content, context);
    
    // result is CanonValidationResult, consistencyScore is always present
    expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(result.consistencyScore).toBeLessThanOrEqual(1);
  });
  
  it('should return invalid when errors present', async () => {
    const rule: CanonRule = {
      id: 'always-error',
      name: 'Always Error',
      description: 'Always returns error',
      severity: 'error',
      check: () => [{
        rule: 'always-error',
        severity: 'error',
        location: 'test',
        expected: 'valid',
        actual: 'invalid',
      }],
    };
    
    const engine = new RuleEngine([rule]);
    const val = new CanonValidator(engine, undefined, false);
    
    const content = 'Test content';
    const context = createValidationContext();
    const result = await val.validate(content, context);
    
    expect(result.valid).toBe(false);
  });
  
  it('should return valid when only warnings', async () => {
    const rule: CanonRule = {
      id: 'only-warning',
      name: 'Only Warning',
      description: 'Only returns warning',
      severity: 'warning',
      check: () => [{
        rule: 'only-warning',
        severity: 'warning',
        location: 'test',
        expected: 'valid',
        actual: 'warning case',
      }],
    };
    
    const engine = new RuleEngine([rule]);
    const val = new CanonValidator(engine, undefined, false);
    
    const content = 'Test content';
    const context = createValidationContext();
    const result = await val.validate(content, context);
    
    expect(result.valid).toBe(true);
  });
  
  it('should allow setting LLM judge', () => {
    const mockProvider = createMockProvider();
    const judge = new LLMJudge(mockProvider);
    
    validator.setLLMJudge(judge);
    // Should not throw
  });
  
  it('should allow enabling/disabling LLM judge', () => {
    validator.setUseLLMJudge(true);
    validator.setUseLLMJudge(false);
    // Should not throw
  });
});

describe('DEFAULT_JUDGING_CRITERIA', () => {
  it('should have all required criteria', () => {
    expect(DEFAULT_JUDGING_CRITERIA).toHaveLength(5);
    
    const names = DEFAULT_JUDGING_CRITERIA.map(c => c.name);
    expect(names).toContain('characterConsistency');
    expect(names).toContain('worldConsistency');
    expect(names).toContain('storyContinuity');
    expect(names).toContain('toneConsistency');
    expect(names).toContain('canonCompliance');
  });
  
  it('should have weights that sum to 1', () => {
    const totalWeight = DEFAULT_JUDGING_CRITERIA.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });
  
  it('should have descriptions for all criteria', () => {
    for (const criterion of DEFAULT_JUDGING_CRITERIA) {
      expect(criterion.description).toBeDefined();
      expect(criterion.description.length).toBeGreaterThan(0);
    }
  });
});