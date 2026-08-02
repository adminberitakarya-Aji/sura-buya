/**
 * Suro-Buya Engine v2 - Generate Module
 * 
 * Multi-model comparison, orchestration, and merge utilities
 */

export * from './types.js';
export * from './comparison-orchestrator.js';
export * from './merge-utils.js';

// Re-export commonly used types
export type {
  ComparisonSessionConfig,
  ComparisonModelConfig,
  ComparisonResult,
  ComparisonScores,
  ComparisonSession,
  ComparisonSessionStatus,
  CreateComparisonSessionInput,
  ComparisonProgressEvent,
  ComparisonRunnerOptions,
  MergeStrategy,
  MergeComparisonInput,
  MergeComparisonResult,
  ComparisonListFilter,
  ComparisonStatistics,
} from './types.js';

export {
  ComparisonOrchestrator,
} from './comparison-orchestrator.js';

export {
  mergeComparisonResults,
  createDiff,
  findCommonSegments,
  highlightDifferences,
  exportComparisonResults,
} from './merge-utils.js';