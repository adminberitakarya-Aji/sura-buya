/**
 * Suro-Buya Engine v2 - Scene Generation Engine
 * 
 * Main entry point for the engine v2 package.
 * Provides scene generation, validation, and universe management capabilities.
 */

// Core modules
export * from './commands.js';
export * from './validate.js';
export * from './generate.js';
export * from './generate/index.js';
export * from './context.js';
export * from './prompt/template.js';
export * from './bible/types.js';
export * from './ai/providers.js';
export * from './skills/base.js';
export * from './skills/registry.js';
export * from './plan/episode-planner.js';
export * from './plan/season-planner.js';

// VF-1.2, VF-1.5 & VF-1.6 — Character (persona parsing + build + reference generator)
export * from './character/persona-parser.js';
export * from './character/character-builder.js';
export * from './character/reference-generator.js';

// VF-1.4 — Media provider skeleton (image/video/voice, fallback chain)
export * from './ai/media-providers/index.js';

// Explicitly re-export AI registry to avoid conflicts
export {
  ProviderRegistry,
  type AITask,
  type TaskProviderConfig,
  type ProviderSpec,
  type ProviderRegistryConfig,
  type ProviderHealth,
  type ProviderSelection,
} from './ai/registry.js';

export { AIProviderFactory, createProviderFactory } from './ai/providers.js';

// Explicitly re-export prompting skills to avoid conflicts
export { 
  FewShotBuilder, 
  createFewShotBuilder, 
  fewShotBuilderRegistration,
  type FewShotExample,
  type FewShotBuilderConfig,
  type FewShotBuilderInput,
  type FewShotBuilderOutput
} from './skills/prompting/few-shot-builder.js';

export { 
  PromptOptimizer, 
  createPromptOptimizer, 
  promptOptimizerRegistration,
  type PromptOptimizerConfig,
  type PromptOptimizerInput,
  type PromptOptimizerOutput
} from './skills/prompting/prompt-optimizer.js';

export { 
  ContextCompressor, 
  createContextCompressor, 
  contextCompressorRegistration,
  type ContextCompressorConfig,
  type ContextCompressorInput,
  type ContextCompressorOutput
} from './skills/prompting/context-compressor.js';

// Re-export all types from types.ts (which includes shared types and engine-specific types)
export * from './types.js';

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