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

// VF-2.3 — Script beat sheet + content guideline check
export * from './script/beat-sheet.js';
export * from './script/content-guideline-check.js';

// VF-2.2 — Script generator (VideoCharacterContext + AIProvider)
export * from './script/script-generator.js';

// VF-2.5 — Storyboard (scene breakdown + prompt builder)
export * from './storyboard/scene-breakdown.js';
export * from './storyboard/prompt-builder.js';

// VF-3.2 — Visual (per-shot keyframe generation + style guide enforcer)
export * from './visual/style-guide-enforcer.js';
export * from './visual/image-generator.js';

// VF-3.4 — Motion (image-to-video per shot + camera motion presets)
export * from './motion/camera-motion.js';
export * from './motion/animation-generator.js';

// VF-4.3 — Audio (voiceover generator + SFX/music selector)
export * from './audio/voiceover-generator.js';
export * from './audio/sfx-selector.js';
export * from './audio/music-selector.js';

// VF-4.5 — Compose (timeline builder + platform preset)
export * from './compose/platform-preset.js';
export * from './compose/timeline-builder.js';

// VF-5.1 — Safety review (baseline platform policy + rating-consistency, generik)
export * from './validate/safety-review.js';

// VF-5.6 — Batch orchestrator + export manager (metadata: title, caption, hashtag)
export * from './batch/batch-orchestrator.js';
export * from './batch/export-manager.js';

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