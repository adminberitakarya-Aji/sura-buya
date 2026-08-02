/**
 * Suro-Buya Engine v2 - Multi-Model Comparison Orchestrator
 * 
 * Coordinates running multiple AI models in parallel and collecting results
 */

import type { ProviderRegistry } from '../ai/registry.js';
import type { AIProvider, AIProviderOptions, AIResponse } from '../ai/providers.js';
import type {
  ComparisonSessionConfig,
  ComparisonModelConfig,
  ComparisonResult,
  ComparisonScores,
  ComparisonProgressEvent,
  ComparisonRunnerOptions,
  ComparisonSessionStatus,
} from './types.js';
import { randomUUID } from 'crypto';

/**
 * Default scoring weights
 */
const DEFAULT_SCORING_WEIGHTS = {
  canon: 0.3,
  quality: 0.3,
  creativity: 0.2,
  instruction: 0.2,
};

/**
 * Cost estimates per 1K tokens (USD) - approximate
 */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Anthropic
  'anthropic:claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'anthropic:claude-3-5-haiku': { input: 0.0008, output: 0.004 },
  'anthropic:claude-3-opus': { input: 0.015, output: 0.075 },
  // OpenAI
  'openai:gpt-4o': { input: 0.0025, output: 0.01 },
  'openai:gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'openai:gpt-4-turbo': { input: 0.01, output: 0.03 },
  // Cohere
  'cohere:command-r-plus': { input: 0.003, output: 0.015 },
  'cohere:command-r': { input: 0.0005, output: 0.0015 },
  // Ollama (local - no cost)
  'ollama:': { input: 0, output: 0 },
};

export class ComparisonOrchestrator {
  private providerRegistry: ProviderRegistry;
  private activeSessions: Map<string, AbortController> = new Map();

  constructor(providerRegistry: ProviderRegistry) {
    this.providerRegistry = providerRegistry;
  }

  /**
   * Run a comparison session with multiple models
   */
  async runComparison(
    config: ComparisonSessionConfig,
    options: ComparisonRunnerOptions = {}
  ): Promise<ComparisonResult[]> {
    const {
      timeoutMs = 120000, // 2 minutes default
      parallel = true,
      judgeModelId,
      scoringWeights,
      onProgress,
    } = options;
    
    // Merge provided weights with defaults
    const mergedScoringWeights = {
      canon: scoringWeights?.canon ?? DEFAULT_SCORING_WEIGHTS.canon,
      quality: scoringWeights?.quality ?? DEFAULT_SCORING_WEIGHTS.quality,
      creativity: scoringWeights?.creativity ?? DEFAULT_SCORING_WEIGHTS.creativity,
      instruction: scoringWeights?.instruction ?? DEFAULT_SCORING_WEIGHTS.instruction,
    };

    const sessionId = randomUUID();
    const abortController = new AbortController();
    this.activeSessions.set(sessionId, abortController);

    try {
      // Initialize progress for all models
      const modelIds = config.models.map(m => m.modelId);
      for (const mId of modelIds) {
        this.emitProgress({
          sessionId,
          modelId: mId,
          stage: 'initializing' as const,
          progress: 0,
          message: 'Initializing...',
        }, onProgress);
      }

      // Generate prompt variants for each model
      const promptVariants = await this.generatePromptVariants(config);
      
      for (const mId of modelIds) {
        this.emitProgress({
          sessionId,
          modelId: mId,
          stage: 'generating' as const,
          progress: 10,
          message: 'Generating...',
        }, onProgress);
      }

      // Run generations
      let results: ComparisonResult[];
      if (parallel) {
        results = await this.runParallelGenerations(
          sessionId,
          config,
          promptVariants,
          timeoutMs,
          onProgress,
          abortController.signal
        );
      } else {
        results = await this.runSequentialGenerations(
          sessionId,
          config,
          promptVariants,
          timeoutMs,
          onProgress,
          abortController.signal
        );
      }

      // Score results
      for (const mId of modelIds) {
        this.emitProgress({
          sessionId,
          modelId: mId,
          stage: 'scoring' as const,
          progress: 80,
          message: 'Scoring outputs...',
        }, onProgress);
      }

      const scoredResults = await this.scoreResults(
        results,
        config,
        judgeModelId,
        mergedScoringWeights,
        onProgress
      );

      // Rank results
      const rankedResults = this.rankResults(scoredResults);

      // Final progress
      for (const mId of modelIds) {
        this.emitProgress({
          sessionId,
          modelId: mId,
          stage: 'completed' as const,
          progress: 100,
          message: 'Completed',
        }, onProgress);
      }

      return rankedResults;
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Generate model-specific prompt variants
   */
  private async generatePromptVariants(config: ComparisonSessionConfig): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};
    
    for (const model of config.models) {
      // Base prompt
      let prompt = config.prompt;
      
      // Add system prompt if provided
      if (config.systemPrompt) {
        prompt = `${config.systemPrompt}\n\n${prompt}`;
      }
      
      // Add context if provided
      if (config.context) {
        const contextParts: string[] = [];
        if (config.context.bibleContext) {
          contextParts.push(`## Bible Context\n${config.context.bibleContext}`);
        }
        if (config.context.canonRules?.length) {
          contextParts.push(`## Canon Rules\n${config.context.canonRules.join('\n')}`);
        }
        if (config.context.characterVoices) {
          contextParts.push(`## Character Voices\n${JSON.stringify(config.context.characterVoices, null, 2)}`);
        }
        if (contextParts.length > 0) {
          prompt = `${contextParts.join('\n\n')}\n\n${prompt}`;
        }
      }

      // Model-specific adjustments could go here
      // e.g., different formatting for different providers
      
      variants[model.modelId] = prompt;
    }
    
    return variants;
  }

  /**
   * Run generations in parallel
   */
  private async runParallelGenerations(
    sessionId: string,
    config: ComparisonSessionConfig,
    promptVariants: Record<string, string>,
    timeoutMs: number,
    onProgress?: (event: ComparisonProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<ComparisonResult[]> {
    const promises = config.models.map(async (model) => {
      const prompt = promptVariants[model.modelId] ?? config.prompt;
      return this.runSingleGeneration(
        sessionId,
        model,
        prompt,
        config.taskType,
        timeoutMs,
        onProgress,
        signal
      );
    });

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const model = config.models[index];
        if (!model) {
          return {
            modelId: `unknown-${index}`,
            modelName: `Unknown Model ${index}`,
            provider: 'unknown',
            output: '',
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            latencyMs: 0,
            costEstimate: 0,
            scores: this.getZeroScores(),
            error: 'Model configuration not found',
            createdAt: new Date(),
          };
        }
        return {
          modelId: model.modelId,
          modelName: model.modelName,
          provider: model.provider,
          output: '',
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          latencyMs: 0,
          costEstimate: 0,
          scores: this.getZeroScores(),
          error: result.reason?.message || 'Generation failed',
          createdAt: new Date(),
        };
      }
    });
  }

  /**
   * Run generations sequentially
   */
  private async runSequentialGenerations(
    sessionId: string,
    config: ComparisonSessionConfig,
    promptVariants: Record<string, string>,
    timeoutMs: number,
    onProgress?: (event: ComparisonProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];
    
    for (const model of config.models) {
      if (signal?.aborted) break;
      
      const prompt = promptVariants[model.modelId] ?? config.prompt;
      const result = await this.runSingleGeneration(
        sessionId,
        model,
        prompt,
        config.taskType,
        timeoutMs,
        onProgress,
        signal
      );
      results.push(result);
    }
    
    return results;
  }

  /**
   * Run generation for a single model
   */
  private async runSingleGeneration(
    sessionId: string,
    model: ComparisonModelConfig,
    prompt: string,
    taskType: ComparisonSessionConfig['taskType'],
    timeoutMs: number,
    onProgress?: (event: ComparisonProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<ComparisonResult> {
    const startTime = Date.now();
    
    try {
      // Get provider for this model
      const provider = await this.getProviderForModel(model, taskType);
      if (!provider) {
        throw new Error(`No provider available for ${model.modelId}`);
      }

      // Emit progress
      this.emitProgress({
        sessionId,
        modelId: model.modelId,
        stage: 'generating',
        progress: 20,
        message: `Generating with ${model.modelName}...`,
      }, onProgress);

      // Build provider options
      const providerOptions: AIProviderOptions = {
        model: model.modelId.split(':')[1] || model.modelId,
        temperature: model.parameters.temperature ?? 0.7,
        maxTokens: model.parameters.maxTokens,
        topP: model.parameters.topP,
        systemPrompt: undefined, // We already embedded system prompt in prompt
      };

      // Run with timeout
      const response = await this.runWithTimeout(
        () => provider.generate(prompt, providerOptions),
        timeoutMs,
        signal
      );

      const latencyMs = Date.now() - startTime;
      const output = response.content;

      // Use actual token usage from provider
      const promptTokens = response.usage.promptTokens || this.estimateTokens(prompt);
      const completionTokens = response.usage.completionTokens || this.estimateTokens(output);
      const totalTokens = response.usage.totalTokens || (promptTokens + completionTokens);

      // Calculate cost
      const costEstimate = this.calculateCost(model.modelId, promptTokens, completionTokens);

      this.emitProgress({
        sessionId,
        modelId: model.modelId,
        stage: 'generating',
        progress: 70,
        message: `Completed ${model.modelName}`,
        partialOutput: output.slice(0, 200),
      }, onProgress);

      return {
        modelId: model.modelId,
        modelName: model.modelName,
        provider: model.provider,
        output,
        tokensUsed: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
        latencyMs,
        costEstimate,
        scores: this.getZeroScores(), // Will be filled by scorer
        createdAt: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emitProgress({
        sessionId,
        modelId: model.modelId,
        stage: 'error',
        progress: 0,
        message: `Failed: ${errorMessage}`,
        error: errorMessage,
      }, onProgress);

      return {
        modelId: model.modelId,
        modelName: model.modelName,
        provider: model.provider,
        output: '',
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        latencyMs,
        costEstimate: 0,
        scores: this.getZeroScores(),
        error: errorMessage,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Get provider for a model
   */
  private async getProviderForModel(
    model: ComparisonModelConfig,
    taskType: ComparisonSessionConfig['taskType']
  ): Promise<AIProvider | null> {
    // Try to get provider from registry
    const provider = this.providerRegistry.getProvider(model.provider);
    if (provider && (await provider.isAvailable())) {
      return provider;
    }

    // Fallback: try to find any available provider for the task
    try {
      const selection = await this.providerRegistry.selectProvider(taskType as any);
      return selection.provider;
    } catch {
      return null;
    }
  }

  /**
   * Run promise with timeout and abort signal
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Aborted'));
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener('abort', abortHandler);
      }

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          if (signal) signal.removeEventListener('abort', abortHandler);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (signal) signal.removeEventListener('abort', abortHandler);
          reject(error);
        });
    });
  }

  /**
   * Score results using LLM-as-judge
   */
  private async scoreResults(
    results: ComparisonResult[],
    config: ComparisonSessionConfig,
    _judgeModelId?: string,
    scoringWeights: typeof DEFAULT_SCORING_WEIGHTS = DEFAULT_SCORING_WEIGHTS,
    onProgress?: (event: ComparisonProgressEvent) => void
  ): Promise<ComparisonResult[]> {
    // Filter successful results
    const successfulResults = results.filter(r => !r.error && r.output);
    
    if (successfulResults.length === 0) {
      return results;
    }

    // For now, use simple heuristic scoring
    // In production, this would call a judge LLM
    for (const result of successfulResults) {
      result.scores = await this.heuristicScore(result, config);
    }

      // Apply weights to calculate overall
    for (const result of successfulResults) {
      const weights = {
        canon: scoringWeights.canon ?? DEFAULT_SCORING_WEIGHTS.canon,
        quality: scoringWeights.quality ?? DEFAULT_SCORING_WEIGHTS.quality,
        creativity: scoringWeights.creativity ?? DEFAULT_SCORING_WEIGHTS.creativity,
        instruction: scoringWeights.instruction ?? DEFAULT_SCORING_WEIGHTS.instruction,
      };
      result.scores.overall = Math.round(
        (result.scores.canon ?? 0) * weights.canon +
        (result.scores.quality ?? 0) * weights.quality +
        (result.scores.creativity ?? 0) * weights.creativity +
        (result.scores.instruction ?? 0) * weights.instruction
      );
      
      // Ensure all scores are numbers
      result.scores.canon = result.scores.canon ?? 0;
      result.scores.quality = result.scores.quality ?? 0;
      result.scores.creativity = result.scores.creativity ?? 0;
      result.scores.instruction = result.scores.instruction ?? 0;
    }

    return results;
  }

  /**
   * Heuristic scoring (placeholder for LLM judge)
   */
  private async heuristicScore(
    result: ComparisonResult,
    config: ComparisonSessionConfig
  ): Promise<ComparisonScores> {
    const output = result.output;
    const prompt = config.prompt;
    
    // Simple heuristics - in production use LLM judge
    const length = output.length;
    const hasDialogue = /"[^"]+"/.test(output);
    const hasAction = /\[.*\]/.test(output) || /\b(said|replied|asked|whispered|shouted)\b/i.test(output);
    const hasSceneStructure = /SCENE|INT\.|EXT\./i.test(output);
    const promptOverlap = this.calculatePromptOverlap(prompt, output);

    return {
      canon: Math.min(100, 50 + (hasSceneStructure ? 20 : 0) + (promptOverlap * 30)),
      quality: Math.min(100, 40 + (hasDialogue ? 15 : 0) + (hasAction ? 15 : 0) + Math.min(30, length / 100)),
      creativity: Math.min(100, 50 + Math.random() * 30), // Placeholder
      instruction: Math.min(100, 60 + (promptOverlap * 40)),
      overall: 0, // Will be calculated with weights
    };
  }

  /**
   * Calculate prompt-output overlap (simple heuristic)
   */
  private calculatePromptOverlap(prompt: string, output: string): number {
    const promptWords = new Set(prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const outputWords = output.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    if (promptWords.size === 0) return 0;
    
    const matches = outputWords.filter(w => promptWords.has(w)).length;
    return Math.min(1, matches / Math.min(promptWords.size, 20));
  }

  /**
   * Rank results by overall score
   */
  private rankResults(results: ComparisonResult[]): ComparisonResult[] {
    const successful = results
      .filter(r => !r.error)
      .sort((a, b) => (b.scores.overall || 0) - (a.scores.overall || 0));
    
    successful.forEach((result, index) => {
      result.rank = index + 1;
    });
    
    // Failed results at the end
    const failed = results.filter(r => r.error);
    failed.forEach(result => {
      result.rank = successful.length + 1;
    });
    
    return [...successful, ...failed];
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate estimated cost
   */
  private calculateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    // Find matching cost entry
    const costKey = Object.keys(MODEL_COSTS).find(key => 
      modelId.startsWith(key.replace(':', '')) || modelId === key
    );
    
    if (!costKey) return 0;
    
    const costs = MODEL_COSTS[costKey];
    if (!costs) return 0;
    
    return (promptTokens / 1000) * costs.input + (completionTokens / 1000) * costs.output;
  }

  /**
   * Get zero scores for failed results
   */
  private getZeroScores(): ComparisonScores {
    return {
      canon: 0,
      quality: 0,
      creativity: 0,
      instruction: 0,
      overall: 0,
    };
  }

  /**
   * Emit progress events
   */
  private emitProgress(
    event: ComparisonProgressEvent,
    callback?: (event: ComparisonProgressEvent) => void
  ): void {
    if (callback) {
      callback(event);
    }
  }

  /**
   * Cancel a running session
   */
  cancelSession(sessionId: string): boolean {
    const controller = this.activeSessions.get(sessionId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}
