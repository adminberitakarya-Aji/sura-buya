/**
 * Suro-Buya Engine v2 - Scene Generation Engine
 * 
 * Main entry point for the engine v2 package.
 * Provides scene generation, validation, and universe management capabilities.
 */

export * from './commands.js';
export * from './validate.js';
export * from './generate.js';
export * from './context.js';
export * from './prompt/template.js';
export * from './ai/registry.js';

// Re-export types explicitly re-export types to avoid conflicts
export type { 
  EngineConfig,
  SceneGenerationInput,
  EpisodeGenerationInput,
  CanonValidationResult,
  GenerationContext,
  EngineStatus,
  CommandResult,
  ValidationRule,
  ValidationContext,
  ValidationViolation,
  GenerationOptions,
  GeneratedScene,
  GeneratedEpisode,
  ContextLoaderOptions,
  UniverseContext,
} from './types.js';

/**
 * Engine version
 */
export const VERSION = '0.1.0';

/**
 * Engine metadata
 */
export const ENGINE_INFO = {
  name: '@suro-buya/engine-v2',
  version: VERSION,
  description: 'Suro-Buya Engine v2 - Scene Generation Engine for IP Universe Development',
} as const;