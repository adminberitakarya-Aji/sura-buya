/**
 * @suro-buya/shared - Types
 * 
 * Shared type definitions for the Suro-Buya universe.
 */

import { z } from 'zod';

/**
 * Base entity interface
 */
export interface BaseEntity {
  /** Unique identifier */
  id: string;
  
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  
  /** Version number for optimistic locking */
  version: number;
}

/**
 * Universe configuration
 */
export interface UniverseConfig {
  /** Universe ID */
  id: string;
  
  /** Universe name */
  name: string;
  
  /** Universe version */
  version: string;
  
  /** Default locale */
  locale: string;
  
  /** Supported locales */
  locales: string[];
  
  /** Timezone */
  timezone: string;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Character archetype
 */
export type CharacterArchetype = 
  | 'protagonist'
  | 'antagonist'
  | 'mentor'
  | 'sidekick'
  | 'love-interest'
  | 'rival'
  | 'comic-relief'
  | 'mysterious'
  | 'guardian'
  | 'trickster';

/**
 * Character profile
 */
export interface CharacterProfile extends BaseEntity {
  /** Character name */
  name: string;
  
  /** Character archetype */
  archetype: CharacterArchetype;
  
  /** Brief description */
  description: string;
  
  /** Detailed backstory */
  backstory?: string;
  
  /** Personality traits */
  traits: string[];
  
  /** Voice characteristics */
  voice?: {
    tone: string;
    vocabulary: string[];
    speechPatterns: string[];
    catchphrases?: string[];
  };
  
  /** Relationships with other characters */
  relationships?: Record<string, {
    type: string;
    description: string;
    strength: number; // 0-1
  }>;
  
  /** Visual reference */
  visualReference?: string;
  
  /** Abilities and skills */
  abilities?: string[];
  
  /** Weaknesses */
  weaknesses?: string[];
  
  /** Character arc */
  arc?: {
    start: string;
    middle: string;
    end: string;
  };
}

/**
 * World/Location profile
 */
export interface WorldProfile extends BaseEntity {
  /** World name */
  name: string;
  
  /** World type */
  type: 'planet' | 'dimension' | 'region' | 'city' | 'location';
  
  /** Description */
  description: string;
  
  /** Geography */
  geography?: {
    climate: string;
    terrain: string[];
    landmarks: string[];
  };
  
  /** Culture */
  culture?: {
    language: string[];
    customs: string[];
    beliefs: string[];
    socialStructure: string;
  };
  
  /** History */
  history?: {
    timeline: Array<{
      era: string;
      events: string[];
    }>;
    keyEvents: string[];
  };
  
  /** Connected locations */
  connections?: string[];
  
  /** Visual reference */
  visualReference?: string;
}

/**
 * Story/Plot profile
 */
export interface StoryProfile extends BaseEntity {
  /** Story title */
  title: string;
  
  /** Story type */
  type: 'series' | 'season' | 'episode' | 'arc' | 'scene';
  
  /** Logline */
  logline: string;
  
  /** Synopsis */
  synopsis: string;
  
  /** Themes */
  themes: string[];
  
  /** Genre */
  genre: string[];
  
  /** Target audience */
  audience: string;
  
  /** Tone */
  tone: string;
  
  /** Structure */
  structure?: {
    acts: number;
    beats: string[];
  };
  
  /** Characters involved */
  characters: string[];
  
  /** Worlds/locations */
  locations: string[];
  
  /** Plot points */
  plotPoints: Array<{
    order: number;
    description: string;
    type: 'setup' | 'inciting' | 'rising' | 'climax' | 'falling' | 'resolution';
  }>;
}

/**
 * Episode structure
 */
export interface EpisodeStructure extends BaseEntity {
  /** Episode number */
  number: number;
  
  /** Season number */
  season: number;
  
  /** Title */
  title: string;
  
  /** Summary */
  summary: string;
  
  /** Scenes */
  scenes: Array<{
    number: number;
    location: string;
    characters: string[];
    summary: string;
    type: 'dialogue' | 'action' | 'exposition' | 'climax' | 'resolution';
    estimatedDuration: number; // minutes
  }>;
  
  /** Themes for this episode */
  themes: string[];
  
  /** Character arcs progressed */
  characterArcs: string[];
}

/**
 * Scene data
 */
export interface SceneData extends BaseEntity {
  /** Scene number */
  number: number;
  
  /** Episode reference */
  episodeId: string;
  
  /** Location */
  location: string;
  
  /** Time of day */
  timeOfDay: string;
  
  /** Characters present */
  characters: string[];
  
  /** Scene type */
  type: 'dialogue' | 'action' | 'exposition' | 'climax' | 'resolution' | 'transition';
  
  /** Beats */
  beats: Array<{
    order: number;
    description: string;
    character?: string;
    dialogue?: string;
    action?: string;
  }>;
  
  /** Estimated duration (minutes) */
  estimatedDuration: number;
  
  /** Visual notes */
  visualNotes?: string;
  
  /** Audio notes */
  audioNotes?: string;
}

/**
 * Generation request
 */
export interface GenerationRequest {
  /** Request ID */
  requestId: string;
  
  /** Universe ID */
  universeId: string;
  
  /** Generation type */
  type: 'scene' | 'episode' | 'story' | 'character' | 'world' | 'dialogue';
  
  /** Input parameters */
  input: Record<string, unknown>;
  
  /** Context */
  context?: {
    previousScenes?: string[];
    characterStates?: Record<string, unknown>;
    worldState?: Record<string, unknown>;
  };
  
  /** Options */
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
}

/**
 * Generation response
 */
export interface GenerationResponse<T = unknown> {
  /** Request ID */
  requestId: string;
  
  /** Success status */
  success: boolean;
  
  /** Generated data */
  data?: T;
  
  /** Error if failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  
  /** Metadata */
  metadata: {
    model: string;
    tokensUsed: number;
    duration: number;
    timestamp: string;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Valid status */
  valid: boolean;
  
  /** Errors */
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  
  /** Warnings */
  warnings: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Canon check result
 */
export interface CanonCheckResult extends ValidationResult {
  /** Violations found */
  violations: Array<{
    rule: string;
    severity: 'error' | 'warning' | 'info';
    location: string;
    expected: unknown;
    actual: unknown;
    suggestion?: string;
  }>;
  
  /** Consistency score (0-1) */
  consistencyScore: number;
}

/**
 * Template definition
 */
export interface TemplateDefinition {
  /** Template ID */
  id: string;
  
  /** Template name */
  name: string;
  
  /** Template category */
  category: 'character' | 'world' | 'story' | 'episode' | 'scene' | 'prompt' | 'schema';
  
  /** Description */
  description: string;
  
  /** Template content (with placeholders) */
  content: string;
  
  /** Variables */
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;
    default?: unknown;
  }>;
  
  /** Example usage */
  example?: Record<string, unknown>;
}

/**
 * Zod schemas for validation
 */
export const SCHEMAS = {
  /** Base entity schema */
  baseEntity: z.object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    version: z.number().int().positive(),
  }),
  
  /** Universe config schema */
  universeConfig: z.object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(128),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    locale: z.string().min(2).max(10),
    locales: z.array(z.string()).min(1),
    timezone: z.string().min(1),
    metadata: z.record(z.unknown()).optional(),
  }),
  
  /** Character profile schema */
  characterProfile: z.object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    version: z.number().int().positive(),
    name: z.string().min(1).max(128),
    archetype: z.enum([
      'protagonist', 'antagonist', 'mentor', 'sidekick', 
      'love-interest', 'rival', 'comic-relief', 'mysterious', 
      'guardian', 'trickster'
    ]),
    description: z.string().min(1).max(1000),
    backstory: z.string().max(5000).optional(),
    traits: z.array(z.string()).min(1),
    voice: z.object({
      tone: z.string(),
      vocabulary: z.array(z.string()),
      speechPatterns: z.array(z.string()),
      catchphrases: z.array(z.string()).optional(),
    }).optional(),
    relationships: z.record(z.object({
      type: z.string(),
      description: z.string(),
      strength: z.number().min(0).max(1),
    })).optional(),
    visualReference: z.string().optional(),
    abilities: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    arc: z.object({
      start: z.string(),
      middle: z.string(),
      end: z.string(),
    }).optional(),
  }),
  
  /** World profile schema */
  worldProfile: z.object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    version: z.number().int().positive(),
    name: z.string().min(1).max(128),
    type: z.enum(['planet', 'dimension', 'region', 'city', 'location']),
    description: z.string().min(1).max(1000),
    geography: z.object({
      climate: z.string(),
      terrain: z.array(z.string()),
      landmarks: z.array(z.string()),
    }).optional(),
    culture: z.object({
      language: z.array(z.string()),
      customs: z.array(z.string()),
      beliefs: z.array(z.string()),
      socialStructure: z.string(),
    }).optional(),
    history: z.object({
      timeline: z.array(z.object({
        era: z.string(),
        events: z.array(z.string()),
      })),
      keyEvents: z.array(z.string()),
    }).optional(),
    connections: z.array(z.string()).optional(),
    visualReference: z.string().optional(),
  }),
  
  /** Generation request schema */
  generationRequest: z.object({
    requestId: z.string().uuid(),
    universeId: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    type: z.enum(['scene', 'episode', 'story', 'character', 'world', 'dialogue']),
    input: z.record(z.unknown()),
    context: z.object({
      previousScenes: z.array(z.string()).optional(),
      characterStates: z.record(z.unknown()).optional(),
      worldState: z.record(z.unknown()).optional(),
    }).optional(),
    options: z.object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      stream: z.boolean().optional(),
    }).optional(),
  }),
};

/**
 * Type inference from schemas
 */
export type BaseEntitySchema = z.infer<typeof SCHEMAS.baseEntity>;
export type UniverseConfigSchema = z.infer<typeof SCHEMAS.universeConfig>;
export type CharacterProfileSchema = z.infer<typeof SCHEMAS.characterProfile>;
export type WorldProfileSchema = z.infer<typeof SCHEMAS.worldProfile>;
export type GenerationRequestSchema = z.infer<typeof SCHEMAS.generationRequest>;