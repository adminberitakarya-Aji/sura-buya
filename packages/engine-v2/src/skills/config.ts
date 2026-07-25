/**
 * Suro-Buya Engine v2 - Skill Configuration
 * 
 * Configuration for skill system per universe via universe.yaml
 */

import { z } from 'zod';
import type { SkillRegistryConfig, PipelineConfig, PipelineMode } from './registry.js';

/**
 * Pipeline configuration schema
 */
export const PipelineConfigSchema = z.object({
  skills: z.array(z.string()),
  mode: z.enum(['sequential', 'parallel', 'hybrid']).default('sequential'),
  stopOnError: z.boolean().default(true),
  skillTimeoutMs: z.number().default(60000),
  globalTimeoutMs: z.number().default(300000),
});

/**
 * Skill configuration schema (matching universe.yaml structure)
 */
export const SkillConfigSchema = z.object({
  /** Skill name */
  name: z.string(),
  /** Whether skill is enabled */
  enabled: z.boolean().default(true),
  /** Skill priority (higher runs first in same category) */
  priority: z.number().default(0),
  /** Skill-specific configuration */
  config: z.record(z.unknown()).default({}),
  /** Override dependencies */
  dependencies: z.array(z.string()).optional(),
  /** Override required flag */
  required: z.boolean().optional(),
});

export type SkillConfig = z.infer<typeof SkillConfigSchema>;

/**
 * Universe skill configuration
 */
export const UniverseSkillConfigSchema = z.object({
  /** Enabled skill categories */
  enabledCategories: z.array(z.string()).default([
    'writing', 'character', 'environment', 'property', 'camera', 'audit', 'prompting'
  ]),
  /** Disabled skills (by name) */
  disabledSkills: z.array(z.string()).default([]),
  /** Skill-specific configurations */
  skills: z.array(SkillConfigSchema).default([]),
  /** Pipeline configurations */
  pipelines: z.record(PipelineConfigSchema).default({}),
  /** Default pipeline name */
  defaultPipeline: z.string().default('scene-generation'),
});

export type UniverseSkillConfig = z.infer<typeof UniverseSkillConfigSchema>;

/**
 * Complete skill system configuration for a universe
 */
export interface SkillSystemConfig {
  /** Universe ID */
  universeId: string;
  /** Skill configuration */
  skills: UniverseSkillConfig;
  /** Engine configuration */
  engineConfig: {
    maxTokens: number;
    defaultTemperature: number;
    maxRetries: number;
    requestTimeout: number;
  };
}

/**
 * Default universe skill configuration
 */
export const DEFAULT_UNIVERSE_SKILL_CONFIG: UniverseSkillConfig = {
  enabledCategories: [
    'writing', 'character', 'environment', 'property', 'camera', 'audit', 'prompting'
  ],
  disabledSkills: [],
  skills: [
    // Writing skills
    { name: 'ScreenplayFormatter', enabled: true, priority: 100, config: {} },
    { name: 'DialogueWriter', enabled: true, priority: 90, config: {} },
    { name: 'ActionWriter', enabled: true, priority: 90, config: {} },
    { name: 'PacingController', enabled: true, priority: 80, config: {} },
    
    // Character skills
    { name: 'VoiceConsistency', enabled: true, priority: 100, config: {} },
    { name: 'ArcProgression', enabled: true, priority: 90, config: {} },
    { name: 'RelationshipMapper', enabled: true, priority: 80, config: {} },
    { name: 'TraitEnforcer', enabled: true, priority: 70, config: {} },
    
    // Environment skills
    { name: 'LoreKeeper', enabled: true, priority: 100, config: {} },
    { name: 'GeographyChecker', enabled: true, priority: 90, config: {} },
    { name: 'CultureValidator', enabled: true, priority: 80, config: {} },
    { name: 'ContinuityGuard', enabled: true, priority: 110, config: {} },
    
    // Property skills
    { name: 'PropTracker', enabled: true, priority: 100, config: {} },
    { name: 'ItemContinuity', enabled: true, priority: 90, config: {} },
    { name: 'VisualReferenceMatcher', enabled: true, priority: 80, config: {} },
    
    // Camera skills
    { name: 'ShotComposer', enabled: true, priority: 100, config: {} },
    { name: 'VisualLanguageEnforcer', enabled: true, priority: 90, config: {} },
    { name: 'StoryboardGenerator', enabled: true, priority: 80, config: {} },
    
    // Audit skills
    { name: 'FormatChecker', enabled: true, priority: 100, config: {} },
    { name: 'CanonValidator', enabled: true, priority: 110, config: {} },
    { name: 'QualityScorer', enabled: true, priority: 90, config: {} },
    { name: 'ConsistencyAuditor', enabled: true, priority: 80, config: {} },
    
    // Prompting skills
    { name: 'FewShotBuilder', enabled: true, priority: 100, config: {} },
    { name: 'PromptOptimizer', enabled: true, priority: 90, config: {} },
    { name: 'ContextCompressor', enabled: true, priority: 80, config: {} },
  ],
  pipelines: {
    'scene-generation': {
      skills: [
        'ContextCompressor',
        'FewShotBuilder',
        'PromptOptimizer',
        'ContinuityGuard',
        'LoreKeeper',
        'GeographyChecker',
        'VoiceConsistency',
        'ArcProgression',
        'TraitEnforcer',
        'PropTracker',
        'ItemContinuity',
        'VisualReferenceMatcher',
        'ShotComposer',
        'VisualLanguageEnforcer',
        'StoryboardGenerator',
        'ScreenplayFormatter',
        'DialogueWriter',
        'ActionWriter',
        'PacingController',
        'FormatChecker',
        'CanonValidator',
        'QualityScorer',
        'ConsistencyAuditor',
      ],
      mode: 'sequential',
      stopOnError: true,
      skillTimeoutMs: 60000,
      globalTimeoutMs: 300000,
    },
    'episode-planning': {
      skills: [
        'ContextCompressor',
        'FewShotBuilder',
        'PromptOptimizer',
        'LoreKeeper',
        'ArcProgression',
        'RelationshipMapper',
      ],
      mode: 'sequential',
      stopOnError: true,
      skillTimeoutMs: 120000,
      globalTimeoutMs: 300000,
    },
    'validation-only': {
      skills: [
        'FormatChecker',
        'CanonValidator',
        'QualityScorer',
        'ConsistencyAuditor',
      ],
      mode: 'parallel',
      stopOnError: false,
      skillTimeoutMs: 30000,
      globalTimeoutMs: 120000,
    },
  },
  defaultPipeline: 'scene-generation',
};

/**
 * Load skill configuration from universe.yaml
 */
export function loadSkillConfigFromUniverseYaml(
  universeYaml: Record<string, unknown>
): UniverseSkillConfig {
  const skillConfig = universeYaml?.['skillConfig'];
  
  if (!skillConfig || typeof skillConfig !== 'object') {
    return DEFAULT_UNIVERSE_SKILL_CONFIG;
  }
  
  // Merge with defaults
  const parsed = UniverseSkillConfigSchema.safeParse(skillConfig);
  if (!parsed.success) {
    console.warn('Invalid skillConfig in universe.yaml, using defaults:', parsed.error);
    return DEFAULT_UNIVERSE_SKILL_CONFIG;
  }
  
  return {
    enabledCategories: parsed.data.enabledCategories ?? DEFAULT_UNIVERSE_SKILL_CONFIG.enabledCategories,
    disabledSkills: parsed.data.disabledSkills ?? DEFAULT_UNIVERSE_SKILL_CONFIG.disabledSkills,
    skills: [...DEFAULT_UNIVERSE_SKILL_CONFIG.skills, ...parsed.data.skills],
    pipelines: { ...DEFAULT_UNIVERSE_SKILL_CONFIG.pipelines, ...parsed.data.pipelines },
    defaultPipeline: parsed.data.defaultPipeline ?? DEFAULT_UNIVERSE_SKILL_CONFIG.defaultPipeline,
  };
}

/**
 * Create skill registry config from universe skill config
 */
export function createSkillRegistryConfig(
  universeSkillConfig: UniverseSkillConfig
): SkillRegistryConfig {
  const enabledSkillNames = new Set(
    universeSkillConfig.skills
      .filter(s => s.enabled && !universeSkillConfig.disabledSkills.includes(s.name))
      .map(s => s.name)
  );
  
  // Filter pipelines to only include enabled skills
  const filteredPipelines: Record<string, PipelineConfig> = {};
  for (const [name, pipeline] of Object.entries(universeSkillConfig.pipelines)) {
    filteredPipelines[name] = {
      ...pipeline,
      skills: pipeline.skills.filter(s => enabledSkillNames.has(s)),
    };
  }
  
  return {
    defaultPipeline: filteredPipelines[universeSkillConfig.defaultPipeline] || {
      skills: Array.from(enabledSkillNames),
      mode: 'sequential',
      stopOnError: true,
      skillTimeoutMs: 60000,
      globalTimeoutMs: 300000,
    },
    universeOverrides: {},
    categoryTimeouts: {
      generation: 120000,
      validation: 30000,
      planning: 60000,
      writing: 90000,
      character: 30000,
      environment: 30000,
      property: 15000,
      camera: 15000,
      audit: 30000,
      prompting: 15000,
    },
  };
}

/**
 * Skill configuration for universe.yaml schema
 */
export const UNIVERSE_YAML_SKILL_CONFIG_SCHEMA = `
# Skill System Configuration (optional)
skillConfig:
  # Enabled skill categories
  enabledCategories:
    - writing
    - character
    - environment
    - property
    - camera
    - audit
    - prompting
  
  # Disabled skills (by name)
  disabledSkills: []
  
  # Skill-specific configurations
  skills:
    - name: ScreenplayFormatter
      enabled: true
      priority: 100
      config:
        format: "screenplay"
        includeSceneNumbers: true
    - name: DialogueWriter
      enabled: true
      priority: 90
      config:
        maxDialogueLines: 20
        useCharacterVoices: true
    - name: CanonValidator
      enabled: true
      priority: 110
      config:
        strictMode: true
        useLLMJudge: true
  
  # Pipeline configurations
  pipelines:
    scene-generation:
      skills:
        - ContextCompressor
        - FewShotBuilder
        - PromptOptimizer
        - ContinuityGuard
        - LoreKeeper
        - VoiceConsistency
        - ScreenplayFormatter
        - DialogueWriter
        - ActionWriter
        - FormatChecker
        - CanonValidator
        - QualityScorer
      mode: sequential
      stopOnError: true
    validation-only:
      skills:
        - FormatChecker
        - CanonValidator
        - QualityScorer
        - ConsistencyAuditor
      mode: parallel
      stopOnError: false
  
  # Default pipeline to use
  defaultPipeline: scene-generation
`;