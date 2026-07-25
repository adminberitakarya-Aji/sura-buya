/**
 * Suro-Buya Engine v2 - Bible Types
 * 
 * Type definitions for bible loading and indexing.
 */

import type { SceneData } from '../types.js';

/**
 * Bible loader interface (forward reference)
 */
export interface BibleLoader {
  load(key: BibleKey): Promise<BibleFile | null>;
  loadAll(keys: BibleKey[]): Promise<BibleFile[]>;
  loadUniverse(): Promise<BibleFile[]>;
  getIndex(): Promise<BibleIndex>;
  clearCache(): void;
  invalidate(key: BibleKey): void;
}

/**
 * Bible file keys - standardized identifiers for bible files
 */
export type BibleKey = 
  | 'characterOverview'
  | 'canonRules'
  | 'voiceGuide'
  | 'relationshipDynamic'
  | 'episodeFormula'
  | 'seasonStructure'
  | `character:${string}`
  | `region:${string}`
  | `custom:${string}`;

/**
 * Bible file with content and metadata
 */
export interface BibleFile {
  /** Standardized key */
  key: BibleKey;
  
  /** Relative path from universe root */
  relPath: string;
  
  /** File content */
  content: string;
  
  /** Estimated token count */
  tokens: number;
  
  /** Last modification time */
  lastModified: Date;
}

/**
 * Bible index - metadata without content for quick lookups
 */
export interface BibleIndex {
  /** Universe ID */
  universeId: string;
  
  /** Map of bible key to metadata */
  files: Map<BibleKey, BibleFileMeta>;
  
  /** Known character IDs from character bibles */
  characterIds: string[];
  
  /** Known region IDs from world bibles */
  regionIds: string[];
  
  /** Total estimated tokens across all files */
  totalTokens: number;
}

/**
 * Bible file metadata (without content)
 */
export interface BibleFileMeta {
  /** Relative path from universe root */
  relPath: string;
  
  /** Estimated token count */
  tokens: number;
  
  /** Last modification time */
  lastModified: Date;
}

/**
 * Bible loader configuration
 */
export interface BibleLoaderConfig {
  /** Root directory for universe bibles */
  universeRoot: string;
  
  /** Whitelist of allowed file patterns (supports wildcards like 'character:*') */
  whitelist: BibleKey[];
  
  /** Whether to cache loaded files in memory */
  cacheEnabled: boolean;
  
  /** Maximum file size to load (bytes) */
  maxFileSize: number;
}

/**
 * Context request for building generation context
 */
export interface ContextRequest {
  /** Universe ID */
  universeId: string;
  
  /** Generation task type */
  task: 'scene' | 'episode' | 'season' | 'character' | 'world' | 'validation';
  
  /** Specific characters to include context for */
  characters?: string[];
  
  /** Specific region to include context for */
  region?: string;
  
  /** Scene/episode premise or prompt */
  premise: string;
  
  /** Additional custom context */
  additionalContext?: Record<string, string>;
  
  /** Token budget for context */
  tokenBudget?: number;
}

/**
 * Context building result
 */
export interface ContextResult {
  /** System prompt for the LLM */
  systemPrompt: string;
  
  /** User prompt with context and task */
  userPrompt: string;
  
  /** Bible files included in context */
  contextFiles: BibleFile[];
  
  /** Estimated token count for the full prompt */
  estimatedTokens: number;
  
  /** Warnings about context building */
  warnings: string[];
}

/**
 * Token budget allocation for different context sections
 */
export interface TokenBudget {
  /** Total budget */
  total: number;
  
  /** Reserved for system prompt */
  systemPrompt: number;
  
  /** Reserved for bible context */
  bibleContext: number;
  
  /** Reserved for task-specific prompt */
  taskPrompt: number;
  
  /** Reserved for response */
  response: number;
  
  /** Safety margin */
  margin: number;
}

/**
 * Default token budgets by task
 */
export const DEFAULT_TOKEN_BUDGETS: Record<ContextRequest['task'], TokenBudget> = {
  scene: {
    total: 8000,
    systemPrompt: 1000,
    bibleContext: 3000,
    taskPrompt: 1000,
    response: 2500,
    margin: 500,
  },
  episode: {
    total: 12000,
    systemPrompt: 1000,
    bibleContext: 4000,
    taskPrompt: 2000,
    response: 4500,
    margin: 500,
  },
  season: {
    total: 16000,
    systemPrompt: 1500,
    bibleContext: 5000,
    taskPrompt: 3000,
    response: 6000,
    margin: 500,
  },
  character: {
    total: 6000,
    systemPrompt: 800,
    bibleContext: 2000,
    taskPrompt: 800,
    response: 2200,
    margin: 200,
  },
  world: {
    total: 6000,
    systemPrompt: 800,
    bibleContext: 2000,
    taskPrompt: 800,
    response: 2200,
    margin: 200,
  },
  validation: {
    total: 4000,
    systemPrompt: 500,
    bibleContext: 1500,
    taskPrompt: 500,
    response: 1300,
    margin: 200,
  },
};

/**
 * Bible section for structured context building
 */
export interface BibleSection {
  /** Section identifier */
  id: string;
  
  /** Human-readable title */
  title: string;
  
  /** Content */
  content: string;
  
  /** Priority (higher = more important) */
  priority: number;
  
  /** Estimated tokens */
  tokens: number;
  
  /** Whether this section is required */
  required: boolean;
}