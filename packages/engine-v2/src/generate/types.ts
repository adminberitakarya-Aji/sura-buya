/**
 * Suro-Buya Engine v2 - Multi-Model Comparison Types
 * 
 * Types for A/B testing multiple AI models side-by-side
 */

import type { AIProviderOptions } from '../ai/providers.js';

/**
 * Model configuration for comparison
 */
export interface ComparisonModelConfig {
  /** Unique model identifier (provider:model format) */
  modelId: string;
  /** Human-readable model name */
  modelName: string;
  /** Provider name (anthropic, openai, cohere, ollama) */
  provider: string;
  /** Model-specific parameters */
  parameters: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    [key: string]: unknown;
  };
}

/**
 * Comparison session configuration
 */
export interface ComparisonSessionConfig {
  /** Models to compare (2-4) */
  models: ComparisonModelConfig[];
  /** Task type for provider selection */
  taskType: 'creative-generation' | 'planning' | 'validation' | 'embedding';
  /** System prompt / context */
  systemPrompt?: string;
  /** User prompt / input */
  prompt: string;
  /** Additional context for generation */
  context?: {
    universeId: string;
    episodeId?: string;
    sceneNumber?: number;
    bibleContext?: string;
    canonRules?: string[];
    characterVoices?: Record<string, string>;
  };
}

/**
 * Individual model result in comparison
 */
export interface ComparisonResult {
  /** Model identifier */
  modelId: string;
  /** Model display name */
  modelName: string;
  /** Provider name */
  provider: string;
  /** Generated output text */
  output: string;
  /** Token usage */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Latency in milliseconds */
  latencyMs: number;
  /** Estimated cost in USD */
  costEstimate: number;
  /** Quality scores (0-100) */
  scores: ComparisonScores;
  /** Rank among compared models (1 = best) */
  rank?: number;
  /** Error if generation failed */
  error?: string;
  /** Timestamp */
  createdAt: Date;
}

/**
 * Quality scoring dimensions
 */
export interface ComparisonScores {
  /** Canon consistency (0-100) */
  canon: number;
  /** Writing quality (0-100) */
  quality: number;
  /** Creativity/originality (0-100) */
  creativity: number;
  /** Instruction following (0-100) */
  instruction: number;
  /** Overall weighted score (0-100) */
  overall: number;
  /** Detailed breakdown for debugging */
  breakdown?: {
    canonDetails?: string;
    qualityDetails?: string;
    creativityDetails?: string;
    instructionDetails?: string;
  };
}

/**
 * Comparison session status
 */
export type ComparisonSessionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Full comparison session
 */
export interface ComparisonSession {
  id: string;
  universeId: string;
  name: string;
  prompt: string;
  promptVariants: Record<string, string>; // modelId -> prompt variant
  status: ComparisonSessionStatus;
  config: ComparisonSessionConfig;
  results: ComparisonResult[];
  winnerId?: string; // references ComparisonResult.id
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Input for creating a comparison session
 */
export interface CreateComparisonSessionInput {
  universeId: string;
  name: string;
  prompt: string;
  models: ComparisonModelConfig[];
  systemPrompt?: string;
  context?: ComparisonSessionConfig['context'];
  createdBy: string;
}

/**
 * Progress event for streaming updates
 */
export interface ComparisonProgressEvent {
  sessionId: string;
  modelId: string;
  stage: 'initializing' | 'generating' | 'scoring' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  partialOutput?: string;
  error?: string;
}

/**
 * Comparison runner options
 */
export interface ComparisonRunnerOptions {
  /** Timeout per model in ms */
  timeoutMs?: number;
  /** Whether to run models in parallel */
  parallel?: boolean;
  /** Judge model for scoring (uses same models if not specified) */
  judgeModelId?: string;
  /** Custom scoring weights */
  scoringWeights?: {
    canon?: number;
    quality?: number;
    creativity?: number;
    instruction?: number;
  };
  /** Callback for progress updates */
  onProgress?: (event: ComparisonProgressEvent) => void;
}

/**
 * Merge strategy for combining outputs
 */
export type MergeStrategy = 
  | 'winner-only'       // Use only winner output
  | 'manual'            // User manually merges
  | 'auto-best-segments'; // Auto-pick best segments (future)

/**
 * Merge input
 */
export interface MergeComparisonInput {
  sessionId: string;
  strategy: MergeStrategy;
  manualSelection?: {
    resultId: string;
    segments: Array<{
      start: number;
      end: number;
      sourceResultId: string;
    }>;
  };
  targetSceneId?: string; // If merging into existing scene
}

/**
 * Merge result
 */
export interface MergeComparisonResult {
  mergedOutput: string;
  sources: Array<{
    resultId: string;
    modelName: string;
    segments: Array<{ start: number; end: number }>;
  }>;
}

/**
 * Comparison list filter
 */
export interface ComparisonListFilter {
  universeId: string;
  status?: ComparisonSessionStatus;
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Comparison statistics
 */
export interface ComparisonStatistics {
  totalSessions: number;
  completedSessions: number;
  averageModelsPerSession: number;
  mostUsedModels: Array<{ modelId: string; count: number }>;
  averageScores: ComparisonScores;
  totalCost: number;
  totalTokens: number;
}