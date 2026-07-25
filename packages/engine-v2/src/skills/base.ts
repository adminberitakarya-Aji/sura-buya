/**
 * Suro-Buya Engine v2 - Base Skill Classes
 * 
 * Base classes for all skills in the skill pipeline system.
 */

import { z } from 'zod';
import type { 
  GenerationContext, 
  SceneGenerationInput, 
  EpisodeGenerationInput,
  SceneData,
  EngineConfig,
  GenerationOptions,
  ValidationContext,
  CanonValidationResult 
} from '../types.js';

/**
 * Skill execution context passed through the pipeline
 */
export interface SkillContext {
  /** Universe configuration */
  universeConfig: GenerationContext['universeConfig'];
  /** Character bibles */
  characterBibles: GenerationContext['characterBibles'];
  /** World bibles */
  worldBibles: GenerationContext['worldBibles'];
  /** Story profile */
  storyProfile: GenerationContext['storyProfile'];
  /** Episode structure */
  episodeStructure: GenerationContext['episodeStructure'];
  /** Previous scenes */
  previousScenes: GenerationContext['previousScenes'];
  /** Current character states */
  characterStates: GenerationContext['characterStates'];
  /** Current world state */
  worldState: GenerationContext['worldState'];
  /** Skill-specific data passed between skills */
  skillData: Record<string, unknown>;
  /** Generation options */
  options: GenerationOptions;
  /** Engine config */
  engineConfig: EngineConfig;
}

/**
 * Result of a skill execution
 */
export interface SkillResult<T = unknown> {
  /** Whether the skill executed successfully */
  success: boolean;
  /** Output data from the skill */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Warnings generated during execution */
  warnings?: string[];
  /** Metadata about execution */
  metadata: {
    /** Skill name */
    skillName: string;
    /** Execution time in ms */
    durationMs: number;
    /** Timestamp */
    timestamp: string;
    /** Whether skill was skipped */
    skipped: boolean;
  };
}

/**
 * Base skill interface
 */
export interface Skill<TInput = unknown, TOutput = unknown> {
  /** Unique skill name */
  name: string;
  /** Skill version */
  version: string;
  /** Skill description */
  description: string;
  /** Skill category */
  category: SkillCategory;
  /** Dependencies - other skills that must run before this one */
  dependencies: string[];
  /** Whether this skill is required (fails pipeline if false) */
  required: boolean;
  /** Skill configuration schema */
  configSchema?: z.ZodSchema;
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
  
  /**
   * Initialize the skill with configuration
   */
  initialize(config?: Record<string, unknown>): Promise<void>;
  
  /**
   * Execute the skill
   */
  execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;
  
  /**
   * Validate skill configuration
   */
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] };
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

/**
 * Skill categories
 */
export type SkillCategory = 
  | 'generation'
  | 'validation'
  | 'planning'
  | 'writing'
  | 'character'
  | 'environment'
  | 'property'
  | 'camera'
  | 'audit'
  | 'prompting'
  | 'custom';

/**
 * Base class for generation skills
 */
export abstract class GenerationSkill<TInput = unknown, TOutput = unknown, TConfig extends Record<string, unknown> = Record<string, unknown>> implements Skill<TInput, TOutput> {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  category: SkillCategory = 'generation';
  dependencies: string[] = [];
  required: boolean = true;
  configSchema?: z.ZodType<TConfig>;
  defaultConfig?: TConfig;
  protected config: TConfig = {} as TConfig;

  async initialize(config?: Partial<TConfig>): Promise<void> {
    this.config = { ...this.defaultConfig, ...config } as TConfig;
    if (this.configSchema) {
      const result = this.configSchema.safeParse(this.config);
      if (!result.success) {
        throw new Error(`Invalid config for ${this.name}: ${result.error.message}`);
      }
    }
  }

  abstract execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    if (!this.configSchema) return { valid: true, errors: [] };
    const result = this.configSchema.safeParse(config);
    return {
      valid: result.success,
      errors: result.success ? [] : result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
}

/**
 * Base class for validation skills
 */
export abstract class ValidationSkill<TInput = unknown, TOutput = unknown, TConfig extends Record<string, unknown> = Record<string, unknown>> implements Skill<TInput, TOutput> {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  category: SkillCategory = 'validation';
  dependencies: string[] = [];
  required: boolean = false;
  configSchema?: z.ZodType<TConfig>;
  defaultConfig?: TConfig;
  protected config: TConfig = {} as TConfig;

  async initialize(config?: Partial<TConfig>): Promise<void> {
    this.config = { ...this.defaultConfig, ...config } as TConfig;
    if (this.configSchema) {
      const result = this.configSchema.safeParse(this.config);
      if (!result.success) {
        throw new Error(`Invalid config for ${this.name}: ${result.error.message}`);
      }
    }
  }

  abstract execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    if (!this.configSchema) return { valid: true, errors: [] };
    const result = this.configSchema.safeParse(config);
    return {
      valid: result.success,
      errors: result.success ? [] : result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
}

/**
 * Base class for planning skills
 */
export abstract class PlanningSkill<TInput = unknown, TOutput = unknown> implements Skill<TInput, TOutput> {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  category: SkillCategory = 'planning';
  dependencies: string[] = [];
  required: boolean = true;
  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, unknown>;
  protected config: Record<string, unknown> = {};

  async initialize(config?: Record<string, unknown>): Promise<void> {
    this.config = { ...this.defaultConfig, ...config };
    if (this.configSchema) {
      const result = this.configSchema.safeParse(this.config);
      if (!result.success) {
        throw new Error(`Invalid config for ${this.name}: ${result.error.message}`);
      }
    }
  }

  abstract execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    if (!this.configSchema) return { valid: true, errors: [] };
    const result = this.configSchema.safeParse(config);
    return {
      valid: result.success,
      errors: result.success ? [] : result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
}

/**
 * Base class for writing skills
 */
export abstract class WritingSkill<TInput = unknown, TOutput = unknown> extends GenerationSkill<TInput, TOutput> {
  override category: SkillCategory = 'writing';
}

/**
 * Base class for character skills
 */
export abstract class CharacterSkill<TInput = unknown, TOutput = unknown> extends GenerationSkill<TInput, TOutput> {
  override category: SkillCategory = 'character';
}

/**
 * Base class for environment skills
 */
export abstract class EnvironmentSkill<TInput = unknown, TOutput = unknown> extends GenerationSkill<TInput, TOutput> {
  override category: SkillCategory = 'environment';
}

/**
 * Base class for property skills
 */
export abstract class PropertySkill<TInput = unknown, TOutput = unknown> extends GenerationSkill<TInput, TOutput> {
  override category: SkillCategory = 'property';
}

/**
 * Base class for camera skills
 */
export abstract class CameraSkill<TInput = unknown, TOutput = unknown> extends GenerationSkill<TInput, TOutput> {
  override category: SkillCategory = 'camera';
}

/**
 * Base class for audit skills
 */
export abstract class AuditSkill<TInput = unknown, TOutput = unknown, TConfig extends Record<string, unknown> = Record<string, unknown>> extends ValidationSkill<TInput, TOutput, TConfig> {
  override category: SkillCategory = 'audit';
}

/**
 * Base class for prompting skills
 */
export abstract class PromptingSkill<TInput = unknown, TOutput = unknown> extends GenerationSkill<TInput, TOutput> {
  override category: SkillCategory = 'prompting';
}

/**
 * Skill metadata for registration
 */
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  dependencies: string[];
  required: boolean;
  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, unknown>;
}

/**
 * Factory function type for creating skills
 */
export type SkillFactory<T extends Skill = Skill> = (config?: Record<string, unknown>) => Promise<T>;

/**
 * Skill registration entry
 */
export interface SkillRegistration {
  metadata: SkillMetadata;
  factory: SkillFactory;
  instance?: Skill;
}