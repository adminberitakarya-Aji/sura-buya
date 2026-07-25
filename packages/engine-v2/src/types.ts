/**
 * Suro-Buya Engine v2 - Type Definitions
 * 
 * Core type definitions for the scene generation engine.
 */

import type { 
  UniverseConfig, 
  CharacterProfile, 
  WorldProfile, 
  StoryProfile, 
  EpisodeStructure, 
  SceneData,
  GenerationRequest,
  GenerationResponse,
  ValidationResult,
  CanonCheckResult 
} from '@suro-buya/shared';

// Re-export shared types for convenience
export type { 
  UniverseConfig, 
  CharacterProfile, 
  WorldProfile, 
  StoryProfile, 
  EpisodeStructure, 
  SceneData,
  GenerationRequest,
  GenerationResponse,
  ValidationResult,
  CanonCheckResult 
} from '@suro-buya/shared';

/**
 * Canon validation rules and context
 */
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: ValidationContext) => ValidationViolation[];
}

export interface ValidationContext {
  content: string;
  contentType: 'scene' | 'episode' | 'story' | 'character' | 'world';
  universeConfig: GenerationContext['universeConfig'];
  characterBibles: GenerationContext['characterBibles'];
  worldBibles: GenerationContext['worldBibles'];
  storyProfile: GenerationContext['storyProfile'];
  episodeStructure?: GenerationContext['episodeStructure'];
  sceneData?: SceneData;
  characterProfile?: CharacterProfile;
  worldProfile?: WorldProfile;
}

export interface ValidationViolation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  location: string;
  expected: unknown;
  actual: unknown;
  suggestion?: string;
}

/**
 * Engine configuration
 */
export interface EngineConfig {
  /** Engine version */
  version: string;
  
  /** Default model for generation */
  defaultModel: string;
  
  /** Maximum tokens per generation */
  maxTokens: number;
  
  /** Default temperature */
  defaultTemperature: number;
  
  /** Request timeout in ms */
  requestTimeout: number;
  
  /** Maximum retry attempts */
  maxRetries: number;
}

/**
 * Scene generation input
 */
export interface SceneGenerationInput {
  /** Universe ID */
  universeId: string;
  
  /** Episode ID */
  episodeId: string;
  
  /** Scene number */
  sceneNumber: number;
  
  /** Scene location */
  location: string;
  
  /** Time of day */
  timeOfDay: string;
  
  /** Characters present */
  characters: string[];
  
  /** Scene type */
  type: 'dialogue' | 'action' | 'exposition' | 'climax' | 'resolution' | 'transition';
  
  /** Estimated duration (minutes) */
  estimatedDuration: number;
  
  /** Key story beats */
  keyBeats: string[];
  
  /** Previous scene summary (optional) */
  previousSceneSummary?: string;
  
  /** Special instructions (optional) */
  specialInstructions?: string;
}

/**
 * Episode generation input
 */
export interface EpisodeGenerationInput {
  /** Universe ID */
  universeId: string;
  
  /** Season number */
  seasonNumber: number;
  
  /** Episode number */
  episodeNumber: number;
  
  /** Episode title */
  title: string;
  
  /** Story arc identifier */
  storyArc?: string;
  
  /** Focus characters */
  focusCharacters: string[];
  
  /** Key plot points */
  keyPlotPoints: string[];
  
  /** Episode themes */
  themes: string[];
  
  /** Target runtime (minutes) */
  targetRuntime: number;
  
  /** Number of scenes */
  sceneCount: number;
}

/**
 * Canon validation result
 */
export interface CanonValidationResult extends CanonCheckResult {
  /** Overall validity */
  valid: boolean;
  
  /** Consistency score (0-1) */
  consistencyScore: number;
  
  /** Detailed violations */
  violations: Array<{
    rule: string;
    severity: 'error' | 'warning' | 'info';
    location: string;
    expected: unknown;
    actual: unknown;
    suggestion?: string;
  }>;
  
  /** Errors found */
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  
  /** Warnings found */
  warnings: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  
  /** Infos found */
  infos: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Context for generation
 */
export interface GenerationContext {
  /** Universe configuration */
  universeConfig: UniverseConfig;
  
  /** Character bibles */
  characterBibles: Record<string, CharacterProfile>;
  
  /** World bibles */
  worldBibles: Record<string, WorldProfile>;
  
  /** Story profile */
  storyProfile: StoryProfile;
  
  /** Episode structure */
  episodeStructure: EpisodeStructure;
  
  /** Previous scenes */
  previousScenes: SceneData[];
  
  /** Current character states */
  characterStates: Record<string, unknown>;
  
  /** Current world state */
  worldState: Record<string, unknown>;
}

/**
 * Engine status
 */
export interface EngineStatus {
  /** Engine version */
  version: string;
  
  /** Whether engine is ready */
  ready: boolean;
  
  /** Loaded universes */
  loadedUniverses: string[];
  
  /** Active generations */
  activeGenerations: number;
  
  /** Memory usage (MB) */
  memoryUsage: number;
}

/**
 * CLI command result
 */
export interface CommandResult {
  /** Success status */
  success: boolean;
  
  /** Output message */
  message: string;
  
  /** Data payload */
  data?: unknown;
  
  /** Error if failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Generation options
 */
export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  seed?: number;
  topP?: number;
  stop?: string[];
}

/**
 * Generated scene output
 */
export interface GeneratedScene {
  scene: SceneData;
  content: string;
  metadata: {
    model: string;
    tokensUsed: number;
    duration: number;
    timestamp: string;
  };
}

/**
 * Generated episode output
 */
export interface GeneratedEpisode {
  episode: EpisodeStructure;
  scenes: GeneratedScene[];
  metadata: {
    model: string;
    totalTokens: number;
    duration: number;
    timestamp: string;
  };
}

/**
 * Context loader options
 */
export interface ContextLoaderOptions {
  universeDir: string;
  cache?: boolean;
}

/**
 * Loaded universe context
 */
export interface UniverseContext {
  config: UniverseConfig;
  characters: Record<string, CharacterProfile>;
  worlds: Record<string, WorldProfile>;
  story: StoryProfile;
  episodes: Record<string, EpisodeStructure>;
  scenes: Record<string, SceneData>;
}
