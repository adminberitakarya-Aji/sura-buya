/**
 * Suro-Buya Engine v2 - Skill Registry
 * 
 * Central registry for managing skills in the pipeline system.
 * Handles registration, dependency resolution, and pipeline execution.
 */

import { z } from 'zod';
import type { 
  Skill, 
  SkillContext, 
  SkillResult, 
  SkillMetadata, 
  SkillFactory, 
  SkillRegistration,
  SkillCategory 
} from './base.js';
import type { EngineConfig, GenerationOptions, GenerationContext } from '../types.js';

// Import new skills
import { PropTracker, createPropTracker } from './property/prop-tracker.js';
import { ItemContinuity, createItemContinuity } from './property/item-continuity.js';
import { VisualReferenceMatcher, createVisualReferenceMatcher } from './property/visual-reference-matcher.js';
import { ShotComposer, createShotComposer } from './camera/shot-composer.js';
import { VisualLanguageEnforcer, createVisualLanguageEnforcer } from './camera/visual-language-enforcer.js';
import { StoryboardGenerator, createStoryboardGenerator } from './camera/storyboard-generator.js';
import { FormatChecker, createFormatChecker } from './audit/format-checker.js';
import { CanonValidator, createCanonValidator } from './audit/canon-validator.js';
import { QualityScorer, createQualityScorer } from './audit/quality-scorer.js';
import { ConsistencyAuditor, createConsistencyAuditor } from './audit/consistency-auditor.js';
import { FewShotBuilder, createFewShotBuilder, fewShotBuilderRegistration } from './prompting/few-shot-builder.js';
import { PromptOptimizer, createPromptOptimizer, promptOptimizerRegistration } from './prompting/prompt-optimizer.js';
import { ContextCompressor, createContextCompressor } from './prompting/context-compressor.js';

/**
 * Creates default skill registrations for Phase 1.5: Skill System
 */
export function createDefaultSkillRegistrations(): SkillRegistration[] {
  return [
    // Property Skills
    {
      metadata: {
        name: 'PropTracker',
        version: '1.0.0',
        description: 'Tracks props and items across scenes for continuity',
        category: 'property',
        dependencies: ['ContinuityGuard'],
        required: false,
        configSchema: PropTracker.prototype.configSchema,
        defaultConfig: PropTracker.prototype.defaultConfig,
      },
      factory: createPropTracker,
    },
    {
      metadata: {
        name: 'ItemContinuity',
        version: '1.0.0',
        description: 'Ensures item continuity and consistency across scenes',
        category: 'property',
        dependencies: ['PropTracker', 'ContinuityGuard'],
        required: false,
        configSchema: ItemContinuity.prototype.configSchema,
        defaultConfig: ItemContinuity.prototype.defaultConfig,
      },
      factory: createItemContinuity,
    },
    {
      metadata: {
        name: 'VisualReferenceMatcher',
        version: '1.0.0',
        description: 'Matches visual references and descriptions across scenes for consistency',
        category: 'property',
        dependencies: ['PropTracker', 'ItemContinuity', 'ContinuityGuard'],
        required: false,
        configSchema: VisualReferenceMatcher.prototype.configSchema,
        defaultConfig: VisualReferenceMatcher.prototype.defaultConfig,
      },
      factory: createVisualReferenceMatcher,
    },
    
    // Camera Skills
    {
      metadata: {
        name: 'ShotComposer',
        version: '1.0.0',
        description: 'Composes cinematic shots and camera directions for scenes',
        category: 'camera',
        dependencies: ['ContinuityGuard', 'VisualReferenceMatcher'],
        required: false,
        configSchema: ShotComposer.prototype.configSchema,
        defaultConfig: ShotComposer.prototype.defaultConfig,
      },
      factory: createShotComposer,
    },
    {
      metadata: {
        name: 'VisualLanguageEnforcer',
        version: '1.0.0',
        description: 'Enforces consistent visual language and style across episodes',
        category: 'camera',
        dependencies: ['ShotComposer', 'ContinuityGuard'],
        required: false,
        configSchema: VisualLanguageEnforcer.prototype.configSchema,
        defaultConfig: VisualLanguageEnforcer.prototype.defaultConfig,
      },
      factory: createVisualLanguageEnforcer,
    },
    {
      metadata: {
        name: 'StoryboardGenerator',
        version: '1.0.0',
        description: 'Generates storyboard descriptions from shot compositions',
        category: 'camera',
        dependencies: ['ShotComposer', 'VisualLanguageEnforcer'],
        required: false,
        configSchema: StoryboardGenerator.prototype.configSchema,
        defaultConfig: StoryboardGenerator.prototype.defaultConfig,
      },
      factory: createStoryboardGenerator,
    },
    
    // Audit Skills
    {
      metadata: {
        name: 'FormatChecker',
        version: '1.0.0',
        description: 'Validates screenplay format compliance',
        category: 'audit',
        dependencies: ['ScreenplayFormatter'],
        required: true,
        configSchema: FormatChecker.prototype.configSchema,
        defaultConfig: FormatChecker.prototype.defaultConfig,
      },
      factory: createFormatChecker,
    },
    {
      metadata: {
        name: 'CanonValidator',
        version: '1.0.0',
        description: 'Validates generated content against universe bible canon',
        category: 'audit',
        dependencies: ['ContinuityGuard'],
        required: true,
        configSchema: CanonValidator.prototype.configSchema,
        defaultConfig: CanonValidator.prototype.defaultConfig,
      },
      factory: createCanonValidator,
    },
    {
      metadata: {
        name: 'QualityScorer',
        version: '1.0.0',
        description: 'Scores generated content quality across multiple dimensions',
        category: 'audit',
        dependencies: ['FormatChecker'],
        required: true,
        configSchema: QualityScorer.prototype.configSchema,
        defaultConfig: QualityScorer.prototype.defaultConfig,
      },
      factory: createQualityScorer,
    },
    {
      metadata: {
        name: 'ConsistencyAuditor',
        version: '1.0.0',
        description: 'Audits content for internal consistency across characters, plot, world, and timeline',
        category: 'audit',
        dependencies: ['CanonValidator', 'ContinuityGuard'],
        required: true,
        configSchema: ConsistencyAuditor.prototype.configSchema,
        defaultConfig: ConsistencyAuditor.prototype.defaultConfig,
    },
      factory: createConsistencyAuditor,
    },
    // Prompting Skills (Phase 1.5)
    {
      metadata: fewShotBuilderRegistration.metadata,
      factory: fewShotBuilderRegistration.factory,
    },
    {
      metadata: promptOptimizerRegistration.metadata,
      factory: promptOptimizerRegistration.factory,
    },
    {
      metadata: {
        name: 'ContextCompressor',
        version: '1.0.0',
        description: 'Compresses context for efficient prompt token usage',
        category: 'prompting',
        dependencies: [],
        required: false,
        configSchema: ContextCompressor.prototype.configSchema,
        defaultConfig: ContextCompressor.prototype.defaultConfig,
      },
      factory: createContextCompressor,
    },
  ];
}

/**
 * Pipeline execution mode
 */
export type PipelineMode = 'sequential' | 'parallel' | 'hybrid';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Skills to execute in this pipeline */
  skills: string[];
  /** Execution mode */
  mode: PipelineMode;
  /** Whether to stop on first error */
  stopOnError: boolean;
  /** Timeout per skill in ms */
  skillTimeoutMs: number;
  /** Global timeout in ms */
  globalTimeoutMs: number;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult<T = unknown> {
  /** Whether pipeline completed successfully */
  success: boolean;
  /** Final output data */
  data?: T;
  /** Errors encountered */
  errors: Array<{ skill: string; error: string }>;
  /** Warnings from skills */
  warnings: string[];
  /** Results from each skill */
  skillResults: Record<string, SkillResult>;
  /** Total execution time in ms */
  durationMs: number;
  /** Skills that were executed */
  executedSkills: string[];
  /** Skills that were skipped */
  skippedSkills: string[];
}

/**
 * Skill registry configuration
 */
export interface SkillRegistryConfig {
  /** Default pipeline configuration */
  defaultPipeline: PipelineConfig;
  /** Universe-specific skill overrides */
  universeOverrides?: Record<string, string[]>;
  /** Category-specific timeouts */
  categoryTimeouts?: Partial<Record<SkillCategory, number>>;
}

/**
 * Skill Registry - Central registry for skill management
 */
export class SkillRegistry {
  private skills: Map<string, SkillRegistration> = new Map();
  private pipelines: Map<string, PipelineConfig> = new Map();
  private config: SkillRegistryConfig;
  private initialized: Set<string> = new Set();

  constructor(config: SkillRegistryConfig) {
    this.config = config;
  }

  /**
   * Register a skill
   */
  register(registration: SkillRegistration): void {
    const { metadata } = registration;
    
    if (this.skills.has(metadata.name)) {
      throw new Error(`Skill '${metadata.name}' is already registered`);
    }

    this.skills.set(metadata.name, registration);
    this.initialized.delete(metadata.name);
  }

  /**
   * Register multiple skills
   */
  registerAll(registrations: SkillRegistration[]): void {
    for (const reg of registrations) {
      this.register(reg);
    }
  }

  /**
   * Unregister a skill
   */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /**
   * Get skill registration
   */
  getRegistration(name: string): SkillRegistration | undefined {
    return this.skills.get(name);
  }

  /**
   * Get skill instance (creates if needed)
   */
  async getSkill(name: string, config?: Record<string, unknown>): Promise<Skill | undefined> {
    const registration = this.skills.get(name);
    if (!registration) {
      return undefined;
    }

    if (!registration.instance) {
      registration.instance = await registration.factory(config);
      await registration.instance.initialize(config);
      this.initialized.add(name);
    }

    return registration.instance;
  }

  /**
   * Get all registered skill names
   */
  getSkillNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): SkillRegistration[] {
    return Array.from(this.skills.values()).filter(s => s.metadata.category === category);
  }

  /**
   * Get skill metadata
   */
  getSkillMetadata(name: string): SkillMetadata | undefined {
    return this.skills.get(name)?.metadata;
  }

  /**
   * Check if skill is registered
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Register a pipeline
   */
  registerPipeline(name: string, config: PipelineConfig): void {
    // Validate all skills exist
    for (const skillName of config.skills) {
      if (!this.skills.has(skillName)) {
        throw new Error(`Pipeline '${name}' references unknown skill '${skillName}'`);
      }
    }
    this.pipelines.set(name, config);
  }

  /**
   * Get pipeline configuration
   */
  getPipeline(name: string): PipelineConfig | undefined {
    return this.pipelines.get(name);
  }

  /**
   * Get all pipeline names
   */
  getPipelineNames(): string[] {
    return Array.from(this.pipelines.keys());
  }

  /**
   * Resolve skill dependencies (topological sort)
   */
  resolveDependencies(skillNames: string[]): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Build graph
    for (const name of skillNames) {
      const registration = this.skills.get(name);
      if (!registration) continue;
      
      graph.set(name, [...registration.metadata.dependencies]);
      inDegree.set(name, registration.metadata.dependencies.length);
      
      // Ensure dependencies are in graph
      for (const dep of registration.metadata.dependencies) {
        if (!graph.has(dep)) {
          graph.set(dep, []);
          inDegree.set(dep, 0);
        }
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const result: string[] = [];
    
    // Initialize queue with nodes having no dependencies
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      
      // Reduce in-degree of dependents
      for (const [otherNode, deps] of graph) {
        if (deps.includes(node)) {
          const newDegree = (inDegree.get(otherNode) || 0) - 1;
          inDegree.set(otherNode, newDegree);
          if (newDegree === 0) {
            queue.push(otherNode);
          }
        }
      }
    }

    // Check for circular dependencies
    if (result.length !== inDegree.size) {
      throw new Error('Circular dependency detected in skill graph');
    }

    // Filter to only requested skills (and their dependencies)
    const requestedSet = new Set(skillNames);
    return result.filter(name => requestedSet.has(name));
  }

  /**
   * Execute a pipeline
   */
  async executePipeline<T = unknown>(
    pipelineName: string,
    input: T,
    context: SkillContext,
    overrides?: Partial<PipelineConfig>
  ): Promise<PipelineResult<T>> {
    const pipeline = this.pipelines.get(pipelineName) || this.config.defaultPipeline;
    const config = { ...pipeline, ...overrides };
    
    const startTime = Date.now();
    const errors: Array<{ skill: string; error: string }> = [];
    const warnings: string[] = [];
    const skillResults: Record<string, SkillResult> = {};
    const executedSkills: string[] = [];
    const skippedSkills: string[] = [];
    
    let currentInput: unknown = input;
    let data: T | undefined;

    try {
      // Resolve dependencies
      const orderedSkills = this.resolveDependencies(config.skills);
      
      for (const skillName of orderedSkills) {
        const registration = this.skills.get(skillName);
        if (!registration) {
          errors.push({ skill: skillName, error: 'Skill not registered' });
          if (config.stopOnError) break;
          continue;
        }

        const skill = await this.getSkill(skillName);
        if (!skill) {
          errors.push({ skill: skillName, error: 'Failed to initialize skill' });
          if (config.stopOnError) break;
          continue;
        }

        const skillStartTime = Date.now();
        let skillResult: SkillResult;

        try {
          // Execute with timeout
          const timeoutPromise = new Promise<SkillResult>((_, reject) => 
            setTimeout(() => reject(new Error(`Skill timeout after ${config.skillTimeoutMs}ms`)), config.skillTimeoutMs)
          );
          
          skillResult = await Promise.race([
            skill.execute(currentInput, context),
            timeoutPromise
          ]);
          
          skillResult.metadata.durationMs = Date.now() - skillStartTime;
          
        } catch (error) {
          skillResult = {
            success: false,
            error: (error as Error).message,
            metadata: {
              skillName,
              durationMs: Date.now() - skillStartTime,
              timestamp: new Date().toISOString(),
              skipped: false
            }
          };
        }

        skillResults[skillName] = skillResult;
        
        if (skillResult.success) {
          executedSkills.push(skillName);
          currentInput = skillResult.data;
          data = skillResult.data as T;
          
          if (skillResult.warnings && skillResult.warnings.length > 0) {
            warnings.push(...skillResult.warnings.map(w => `${skillName}: ${w}`));
          }
        } else {
          errors.push({ skill: skillName, error: skillResult.error || 'Unknown error' });
          if (registration.metadata.required && config.stopOnError) {
            break;
          }
        }
      }
    } catch (error) {
      errors.push({ skill: 'pipeline', error: (error as Error).message });
    }

    // Clean up
    for (const skillName of executedSkills) {
      const registration = this.skills.get(skillName);
      if (registration?.instance) {
        await registration.instance.cleanup();
      }
    }

    return {
      success: errors.length === 0,
      data,
      errors,
      warnings,
      skillResults,
      durationMs: Date.now() - startTime,
      executedSkills,
      skippedSkills
    };
  }

  /**
   * Execute skills in sequence (simple pipeline)
   */
  async executeSequential<T = unknown>(
    skillNames: string[],
    input: T,
    context: SkillContext,
    options?: { stopOnError?: boolean; skillTimeoutMs?: number }
  ): Promise<PipelineResult<T>> {
    const config: PipelineConfig = {
      skills: skillNames,
      mode: 'sequential',
      stopOnError: options?.stopOnError ?? true,
      skillTimeoutMs: options?.skillTimeoutMs ?? 60000,
      globalTimeoutMs: 300000
    };

    return this.executePipeline('__sequential__', input, context, config);
  }

  /**
   * Create a SkillContext from GenerationContext
   */
  static createSkillContext(
    genContext: GenerationContext,
    options: GenerationOptions = {},
    engineConfig: EngineConfig
  ): SkillContext {
    return {
      universeConfig: genContext.universeConfig,
      characterBibles: genContext.characterBibles,
      worldBibles: genContext.worldBibles,
      storyProfile: genContext.storyProfile,
      episodeStructure: genContext.episodeStructure,
      previousScenes: genContext.previousScenes,
      characterStates: genContext.characterStates,
      worldState: genContext.worldState,
      skillData: {},
      options,
      engineConfig
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): { 
    totalSkills: number; 
    initializedSkills: number; 
    categories: Record<SkillCategory, number>;
    pipelines: number;
  } {
    const categories: Record<SkillCategory, number> = {
      generation: 0, validation: 0, planning: 0, writing: 0,
      character: 0, environment: 0, property: 0, camera: 0,
      audit: 0, prompting: 0, custom: 0
    };

    for (const reg of this.skills.values()) {
      categories[reg.metadata.category]++;
    }

    return {
      totalSkills: this.skills.size,
      initializedSkills: this.initialized.size,
      categories,
      pipelines: this.pipelines.size
    };
  }

  /**
   * Cleanup all initialized skills
   */
  async cleanup(): Promise<void> {
    for (const [name, registration] of this.skills) {
      if (registration.instance && this.initialized.has(name)) {
        await registration.instance.cleanup();
      }
    }
    this.initialized.clear();
  }
}

/**
 * Create default skill registry configuration
 */
export function createDefaultRegistryConfig(): SkillRegistryConfig {
  return {
    defaultPipeline: {
      skills: [],
      mode: 'sequential',
      stopOnError: true,
      skillTimeoutMs: 60000,
      globalTimeoutMs: 300000
    },
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
      prompting: 15000
    }
  };
}

/**
 * Skill Registry Builder for fluent configuration
 */
export class SkillRegistryBuilder {
  private skills: SkillRegistration[] = [];
  private pipelines: Map<string, PipelineConfig> = new Map();
  private config: SkillRegistryConfig;

  constructor(baseConfig?: Partial<SkillRegistryConfig>) {
    this.config = createDefaultRegistryConfig();
    if (baseConfig) {
      this.config = { ...this.config, ...baseConfig };
    }
  }

  addSkill(registration: SkillRegistration): this {
    this.skills.push(registration);
    return this;
  }

  addSkills(registrations: SkillRegistration[]): this {
    this.skills.push(...registrations);
    return this;
  }

  addPipeline(name: string, config: PipelineConfig): this {
    this.pipelines.set(name, config);
    return this;
  }

  setDefaultPipeline(config: PipelineConfig): this {
    this.config.defaultPipeline = config;
    return this;
  }

  build(): SkillRegistry {
    const registry = new SkillRegistry(this.config);
    registry.registerAll(this.skills);
    for (const [name, config] of this.pipelines) {
      registry.registerPipeline(name, config);
    }
    return registry;
  }
}