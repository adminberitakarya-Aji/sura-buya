/**
 * @suro-buya/templates - Schema Definitions
 * 
 * Zod schemas for validating universe templates and data structures.
 */

import { z } from 'zod';
import type { TemplateDefinition, UniverseConfig, CharacterProfile, WorldProfile, StoryProfile, EpisodeStructure, SceneData } from '@suro-buya/shared';

/**
 * Base template schema
 */
export const BaseTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  category: z.enum(['character', 'world', 'story', 'episode', 'scene', 'prompt', 'schema']),
  description: z.string().min(1).max(1000),
  content: z.string().min(1),
  variables: z.array(z.object({
    name: z.string().min(1).max(64),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    required: z.boolean(),
    description: z.string().min(1).max(500),
    default: z.unknown().optional(),
  })),
  example: z.record(z.unknown()).optional(),
});

/**
 * Universe configuration template schema
 */
export const UniverseConfigTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  locale: z.string().min(2).max(10),
  locales: z.array(z.string()).min(1),
  timezone: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Character template schema
 */
export const CharacterTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
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
});

/**
 * World template schema
 */
export const WorldTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
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
});

/**
 * Story template schema
 */
export const StoryTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(256),
  type: z.enum(['series', 'season', 'episode', 'arc', 'scene']),
  logline: z.string().min(1).max(500),
  synopsis: z.string().min(1).max(5000),
  themes: z.array(z.string()).min(1),
  genre: z.array(z.string()).min(1),
  audience: z.string(),
  tone: z.string(),
  structure: z.object({
    acts: z.number().int().positive(),
    beats: z.array(z.string()),
  }).optional(),
  characters: z.array(z.string()).min(1),
  locations: z.array(z.string()).min(1),
  plotPoints: z.array(z.object({
    order: z.number().int().positive(),
    description: z.string(),
    type: z.enum(['setup', 'inciting', 'rising', 'climax', 'falling', 'resolution']),
  })).min(1),
});

/**
 * Episode template schema
 */
export const EpisodeTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  number: z.number().int().positive(),
  season: z.number().int().positive(),
  title: z.string().min(1).max(256),
  summary: z.string().min(1).max(1000),
  scenes: z.array(z.object({
    number: z.number().int().positive(),
    location: z.string(),
    characters: z.array(z.string()).min(1),
    summary: z.string(),
    type: z.enum(['dialogue', 'action', 'exposition', 'climax', 'resolution', 'transition']),
    estimatedDuration: z.number().int().positive(),
  })).min(1),
  themes: z.array(z.string()).min(1),
  characterArcs: z.array(z.string()),
});

/**
 * Scene template schema
 */
export const SceneTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  number: z.number().int().positive(),
  episodeId: z.string().min(1),
  location: z.string(),
  timeOfDay: z.string(),
  characters: z.array(z.string()).min(1),
  type: z.enum(['dialogue', 'action', 'exposition', 'climax', 'resolution', 'transition']),
  beats: z.array(z.object({
    order: z.number().int().positive(),
    description: z.string(),
    character: z.string().optional(),
    dialogue: z.string().optional(),
    action: z.string().optional(),
  })).min(1),
  estimatedDuration: z.number().int().positive(),
  visualNotes: z.string().optional(),
  audioNotes: z.string().optional(),
});

/**
 * Prompt template schema
 */
export const PromptTemplateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  category: z.enum(['generation', 'planning', 'production', 'review', 'validation']),
  description: z.string().min(1).max(1000),
  content: z.string().min(1),
  variables: z.array(z.object({
    name: z.string().min(1).max(64),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    required: z.boolean(),
    description: z.string().min(1).max(500),
    default: z.unknown().optional(),
  })),
  example: z.record(z.unknown()).optional(),
});

/**
 * API schema definitions
 */
export const ApiSchemas = {
  // Request schemas
  generateSceneRequest: z.object({
    universeId: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    episodeId: z.string().min(1),
    sceneNumber: z.number().int().positive(),
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
  
  generateEpisodeRequest: z.object({
    universeId: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    seasonNumber: z.number().int().positive(),
    episodeNumber: z.number().int().positive(),
    storyArc: z.string().optional(),
    options: z.object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    }).optional(),
  }),
  
  validateCanonRequest: z.object({
    universeId: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    content: z.string().min(1),
    contentType: z.enum(['scene', 'episode', 'story', 'character', 'world']),
    strictMode: z.boolean().optional(),
  }),
  
  // Response schemas
  generateSceneResponse: z.object({
    requestId: z.string().uuid(),
    success: z.boolean(),
    data: z.object({
      scene: SceneTemplateSchema,
      metadata: z.object({
        model: z.string(),
        tokensUsed: z.number().int().positive(),
        duration: z.number().int().positive(),
        timestamp: z.string().datetime(),
      }),
    }).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }).optional(),
  }),
  
  validateCanonResponse: z.object({
    requestId: z.string().uuid(),
    success: z.boolean(),
    data: z.object({
      valid: z.boolean(),
      violations: z.array(z.object({
        rule: z.string(),
        severity: z.enum(['error', 'warning', 'info']),
        location: z.string(),
        expected: z.unknown(),
        actual: z.unknown(),
        suggestion: z.string().optional(),
      })),
      consistencyScore: z.number().min(0).max(1),
    }).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }).optional(),
  }),
};

/**
 * All schemas exported as a single object
 */
export const Schemas = {
  baseTemplate: BaseTemplateSchema,
  universeConfig: UniverseConfigTemplateSchema,
  character: CharacterTemplateSchema,
  world: WorldTemplateSchema,
  story: StoryTemplateSchema,
  episode: EpisodeTemplateSchema,
  scene: SceneTemplateSchema,
  prompt: PromptTemplateSchema,
  api: ApiSchemas,
};

/**
 * Type inference from schemas
 */
export type BaseTemplate = z.infer<typeof BaseTemplateSchema>;
export type UniverseConfigTemplate = z.infer<typeof UniverseConfigTemplateSchema>;
export type CharacterTemplate = z.infer<typeof CharacterTemplateSchema>;
export type WorldTemplate = z.infer<typeof WorldTemplateSchema>;
export type StoryTemplate = z.infer<typeof StoryTemplateSchema>;
export type EpisodeTemplate = z.infer<typeof EpisodeTemplateSchema>;
export type SceneTemplate = z.infer<typeof SceneTemplateSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type GenerateSceneRequest = z.infer<typeof ApiSchemas.generateSceneRequest>;
export type GenerateEpisodeRequest = z.infer<typeof ApiSchemas.generateEpisodeRequest>;
export type ValidateCanonRequest = z.infer<typeof ApiSchemas.validateCanonRequest>;
export type GenerateSceneResponse = z.infer<typeof ApiSchemas.generateSceneResponse>;
export type ValidateCanonResponse = z.infer<typeof ApiSchemas.validateCanonResponse>;