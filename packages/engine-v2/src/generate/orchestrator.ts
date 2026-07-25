/**
 * Suro-Buya Engine v2 - Generation Orchestrator
 * 
 * High-level orchestration for scene/episode generation with structured output,
 * retry logic, streaming, and validation integration.
 */

import { z } from 'zod';
import type { 
  GenerationContext, 
  SceneGenerationInput, 
  EpisodeGenerationInput,
  SceneData,
  EpisodeStructure,
  GeneratedScene,
  GeneratedEpisode,
  GenerationOptions,
  EngineConfig,
} from '../types.js';
import { PromptRenderer, createDefaultRenderer } from '../prompt/template.js';
import { ProviderRegistry, createDefaultRegistryConfig, createProviderFactory, AITask } from '../ai/registry.js';
import type { AIProvider, AIProviderOptions, AIResponse } from '../ai/providers.js';
import type { BaseEntity } from '@suro-buya/shared';

/**
 * Structured output schema for scene generation
 */
export const SceneOutputSchema = z.object({
  sceneHeading: z.string().describe('Scene heading (e.g., INT. CAFE - DAY)'),
  actionLines: z.array(z.string()).describe('Action/description lines'),
  dialogue: z.array(z.object({
    character: z.string(),
    line: z.string(),
    parenthetical: z.string().optional(),
  })).describe('Dialogue lines'),
  transitions: z.array(z.string()).optional().describe('Scene transitions'),
  metadata: z.object({
    estimatedDuration: z.number().describe('Estimated duration in seconds'),
    characters: z.array(z.string()).describe('Characters present'),
    location: z.string(),
    timeOfDay: z.string(),
    sceneType: z.string(),
  }).describe('Scene metadata'),
});

export type SceneOutput = z.infer<typeof SceneOutputSchema>;

/**
 * Structured output schema for episode structure
 */
export const EpisodeStructureOutputSchema = z.object({
  title: z.string(),
  season: z.number().int().positive(),
  number: z.number().int().positive(),
  summary: z.string(),
  themes: z.array(z.string()),
  scenes: z.array(z.object({
    number: z.number().int().positive(),
    location: z.string(),
    timeOfDay: z.string(),
    characters: z.array(z.string()),
    summary: z.string(),
    type: z.enum(['exposition', 'dialogue', 'action', 'climax', 'resolution', 'transition']),
    estimatedDuration: z.number().int().positive(),
    keyBeats: z.array(z.string()),
  })),
  runtimeMinutes: z.number().int().positive(),
  actBreaks: z.array(z.number().int().positive()).optional(),
});

export type EpisodeStructureOutput = z.infer<typeof EpisodeStructureOutputSchema>;

/**
 * Generation result with metadata
 */
export interface GenerationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    model: string;
    provider: string;
    tokensUsed: number;
    durationMs: number;
    attempts: number;
    isFallback: boolean;
    structuredOutput: boolean;
  };
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  engineConfig: EngineConfig;
  registry: ProviderRegistry;
  promptRenderer: PromptRenderer;
  enableStructuredOutput: boolean;
  enableStreaming: boolean;
  maxRetries: number;
  timeoutMs: number;
  validateOutput: boolean;
}

/**
 * Default orchestrator configuration
 */
export function createDefaultOrchestratorConfig(
  engineConfig: EngineConfig,
  registry: ProviderRegistry,
  promptRenderer: PromptRenderer
): OrchestratorConfig {
  return {
    engineConfig,
    registry,
    promptRenderer,
    enableStructuredOutput: true,
    enableStreaming: true,
    maxRetries: engineConfig.maxRetries,
    timeoutMs: engineConfig.requestTimeout,
    validateOutput: true,
  };
}

/**
 * Generation Orchestrator - Main entry point for generation
 */
export class GenerationOrchestrator {
  private config: OrchestratorConfig;
  private activeGenerations: Map<string, AbortController> = new Map();

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  /**
   * Generate a complete scene with structured output
   */
  async generateScene(
    input: SceneGenerationInput,
    context: GenerationContext,
    options: GenerationOptions = {}
  ): Promise<GenerationResult<GeneratedScene>> {
    const generationId = `scene-${input.universeId}-${input.episodeId}-${input.sceneNumber}-${Date.now()}`;
    const controller = new AbortController();
    this.activeGenerations.set(generationId, controller);

    const startTime = Date.now();
    let attempts = 0;
    let isFallback = false;

    try {
      // Render prompt
      const renderedPrompt = this.config.promptRenderer.renderScenePrompt(input, context, options);

      // Generate with orchestrator
      const result = await this.generateWithRetry(
        'creative-generation',
        renderedPrompt,
        options,
        controller.signal,
        SceneOutputSchema
      );

      isFallback = result.isFallback;

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Scene generation failed');
      }

      // Convert structured output to SceneData
      const sceneData = this.convertToSceneData(input, result.data, context);

      const generatedScene: GeneratedScene = {
        scene: sceneData,
        content: this.formatSceneOutput(result.data),
        metadata: {
          model: result.metadata.model,
          tokensUsed: result.metadata.tokensUsed,
          duration: result.metadata.durationMs,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        success: true,
        data: generatedScene,
        metadata: {
          model: result.metadata.model,
          provider: result.metadata.provider,
          tokensUsed: result.metadata.tokensUsed,
          durationMs: Date.now() - startTime,
          attempts: result.metadata.attempts,
          isFallback,
          structuredOutput: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          model: this.config.engineConfig.defaultModel,
          provider: 'unknown',
          tokensUsed: 0,
          durationMs: Date.now() - startTime,
          attempts,
          isFallback,
          structuredOutput: false,
        },
      };
    } finally {
      this.activeGenerations.delete(generationId);
    }
  }

  /**
   * Generate episode structure
   */
  async generateEpisodeStructure(
    input: EpisodeGenerationInput,
    context: GenerationContext,
    options: GenerationOptions = {}
  ): Promise<GenerationResult<GeneratedEpisode>> {
    const generationId = `episode-${input.universeId}-S${input.seasonNumber}E${input.episodeNumber}-${Date.now()}`;
    const controller = new AbortController();
    this.activeGenerations.set(generationId, controller);

    const startTime = Date.now();
    let attempts = 0;
    let isFallback = false;

    try {
      // Render prompt
      const renderedPrompt = this.config.promptRenderer.renderEpisodePrompt(input, context, options);

      // Generate structure
      const structureResult = await this.generateWithRetry(
        'planning',
        renderedPrompt,
        options,
        controller.signal,
        EpisodeStructureOutputSchema
      );

      isFallback = structureResult.isFallback;

      if (!structureResult.success || !structureResult.data) {
        throw new Error(structureResult.error || 'Episode structure generation failed');
      }

      // Generate individual scenes
      const scenes: GeneratedScene[] = [];
      const episodeStructure = this.convertToEpisodeStructure(input, structureResult.data);

      for (const sceneInput of this.createSceneInputs(input, episodeStructure, context)) {
        const sceneResult = await this.generateScene(sceneInput, context, options);
        if (sceneResult.success && sceneResult.data) {
          scenes.push(sceneResult.data);
        } else {
          console.warn(`Failed to generate scene ${sceneInput.sceneNumber}: ${sceneResult.error}`);
        }
      }

      const generatedEpisode: GeneratedEpisode = {
        episode: episodeStructure,
        scenes,
        metadata: {
          model: structureResult.metadata.model,
          totalTokens: scenes.reduce((sum, s) => sum + s.metadata.tokensUsed, 0),
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        success: true,
        data: generatedEpisode,
        metadata: {
          model: structureResult.metadata.model,
          provider: structureResult.metadata.provider,
          tokensUsed: structureResult.metadata.tokensUsed,
          durationMs: Date.now() - startTime,
          attempts: structureResult.metadata.attempts,
          isFallback,
          structuredOutput: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          model: this.config.engineConfig.defaultModel,
          provider: 'unknown',
          tokensUsed: 0,
          durationMs: Date.now() - startTime,
          attempts,
          isFallback,
          structuredOutput: false,
        },
      };
    } finally {
      this.activeGenerations.delete(generationId);
    }
  }

  /**
   * Stream scene generation
   */
  async *streamSceneGeneration(
    input: SceneGenerationInput,
    context: GenerationContext,
    options: GenerationOptions = {}
  ): AsyncIterable<{ chunk: string; done: boolean; metadata?: GenerationResult<GeneratedScene>['metadata'] }> {
    const renderedPrompt = this.config.promptRenderer.renderScenePrompt(input, context, options);

    try {
      const task: AITask = 'creative-generation';
      const selection = await this.config.registry.selectProvider(task, options);

      const taskConfig = this.config.registry.getTaskConfig(task);
      const mergedOptions: AIProviderOptions = {
        model: selection.isFallback && taskConfig?.fallback
          ? taskConfig.fallback!.model
          : taskConfig?.primary.model || this.config.engineConfig.defaultModel,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 4000,
        systemPrompt: renderedPrompt.systemPrompt,
        topP: options.topP ?? 0.9,
        stop: options.stop ?? [],
        seed: options.seed,
      };

      let fullContent = '';
      let chunkCount = 0;

      for await (const chunk of selection.provider.generateStream(renderedPrompt.userPrompt, mergedOptions)) {
        fullContent += chunk;
        chunkCount++;
        yield { chunk, done: false };
      }

      // Parse structured output from streamed content
      const structuredOutput = this.parseStructuredOutput(fullContent, SceneOutputSchema);
      
      const model = mergedOptions.model ?? this.config.engineConfig.defaultModel;
      const providerName = selection.provider.name ?? 'unknown';
      
      if (structuredOutput) {
        const sceneData = this.convertToSceneData(input, structuredOutput, context);
        const generatedScene: GeneratedScene = {
          scene: sceneData,
          content: this.formatSceneOutput(structuredOutput),
          metadata: {
            model,
            tokensUsed: this.estimateTokens(fullContent),
            duration: 0,
            timestamp: new Date().toISOString(),
          },
        };

        yield { 
          chunk: '', 
          done: true, 
          metadata: {
            model,
            provider: providerName,
            tokensUsed: this.estimateTokens(fullContent),
            durationMs: 0,
            attempts: 1,
            isFallback: selection.isFallback,
            structuredOutput: true,
          }
        };
      } else {
        yield { 
          chunk: '', 
          done: true, 
          metadata: {
            model,
            provider: providerName,
            tokensUsed: this.estimateTokens(fullContent),
            durationMs: 0,
            attempts: 1,
            isFallback: selection.isFallback,
            structuredOutput: false,
          }
        };
      }
    } catch (error) {
      yield { 
        chunk: '', 
        done: true, 
        metadata: {
          model: this.config.engineConfig.defaultModel,
          provider: 'unknown',
          tokensUsed: 0,
          durationMs: 0,
          attempts: 0,
          isFallback: false,
          structuredOutput: false,
        }
      };
    }
  }

  /**
   * Generate with retry and structured output parsing
   */
  private async generateWithRetry<T extends z.ZodTypeAny>(
    task: AITask,
    renderedPrompt: { systemPrompt: string; userPrompt: string },
    options: GenerationOptions,
    signal: AbortSignal,
    outputSchema: T
  ): Promise<{
    success: boolean;
    data?: z.infer<T>;
    error?: string;
    isFallback: boolean;
    metadata: {
      model: string;
      provider: string;
      tokensUsed: number;
      durationMs: number;
      attempts: number;
    };
  }> {
    let lastError: Error | null = null;
    const maxRetries = this.config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error('Generation aborted');
      }

      try {
        const selection = await this.config.registry.selectProvider(task, options);
        
        const mergedOptions: AIProviderOptions = {
          model: selection.isFallback && this.config.registry.getTaskConfig(task)?.fallback
            ? this.config.registry.getTaskConfig(task)!.fallback!.model
            : this.config.registry.getTaskConfig(task)?.primary.model || this.config.engineConfig.defaultModel,
          temperature: options.temperature ?? this.config.registry.getTaskConfig(task)?.parameters?.temperature ?? 0.7,
          maxTokens: options.maxTokens ?? this.config.registry.getTaskConfig(task)?.parameters?.maxTokens,
          systemPrompt: renderedPrompt.systemPrompt,
          topP: options.topP ?? this.config.registry.getTaskConfig(task)?.parameters?.topP,
          stop: options.stop ?? this.config.registry.getTaskConfig(task)?.parameters?.stop,
          seed: options.seed ?? this.config.registry.getTaskConfig(task)?.parameters?.seed,
        };

        const startTime = Date.now();
        const response = await selection.provider.generate(renderedPrompt.userPrompt, mergedOptions);
        const durationMs = Date.now() - startTime;

        if (response.finishReason === 'error') {
          throw new Error(`Provider error: ${response.content}`);
        }

        // Parse structured output if enabled
        let parsedData: z.infer<T> | undefined;
        if (this.config.enableStructuredOutput && response.content) {
          parsedData = this.parseStructuredOutput(response.content, outputSchema);
        }

        return {
          success: true,
          data: parsedData,
          isFallback: selection.isFallback,
          metadata: {
            model: response.model,
            provider: response.provider,
            tokensUsed: response.usage.totalTokens,
            durationMs,
            attempts: attempt + 1,
          },
        };
      } catch (error) {
        lastError = error as Error;

        // Try fallback on first failure
        if (attempt === 0 && !signal.aborted) {
          const taskConfig = this.config.registry.getTaskConfig(task);
          if (taskConfig?.fallback) {
            // Registry will handle fallback on next selectProvider call
            continue;
          }
        }

        if (attempt < maxRetries && !signal.aborted) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Generation failed after retries',
      isFallback: false,
      metadata: {
        model: this.config.engineConfig.defaultModel,
        provider: 'unknown',
        tokensUsed: 0,
        durationMs: 0,
        attempts: maxRetries + 1,
      },
    };
  }

  /**
   * Parse structured JSON output from LLM response
   */
  private parseStructuredOutput<T extends z.ZodTypeAny>(
    content: string,
    schema: T
  ): z.infer<T> | undefined {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return undefined;

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch {
      return undefined;
    }
  }

  /**
   * Convert structured output to SceneData
   */
  private convertToSceneData(
    input: SceneGenerationInput,
    structuredOutput: SceneOutput,
    context: GenerationContext
  ): SceneData {
    const now = new Date().toISOString();
    return {
      id: `${input.universeId}-${input.episodeId}-${input.sceneNumber}`,
      episodeId: input.episodeId,
      number: input.sceneNumber,
      location: input.location,
      timeOfDay: input.timeOfDay,
      type: input.type as any,
      characters: input.characters,
      estimatedDuration: input.estimatedDuration,
      beats: input.keyBeats.map((beat, index) => ({
        order: index + 1,
        description: beat,
      })),
      visualNotes: '',
      audioNotes: '',
      content: this.formatSceneOutput(structuredOutput),
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        generatedAt: now,
        model: 'unknown',
        tokensUsed: 0,
        structuredOutput,
      },
    } as SceneData;
  }

  /**
   * Format structured output as screenplay text
   */
  private formatSceneOutput(output: SceneOutput): string {
    const lines: string[] = [];

    // Scene heading
    lines.push(output.sceneHeading);

    // Action lines
    for (const action of output.actionLines) {
      lines.push('');
      lines.push(action);
    }

    // Dialogue
    for (const dialogue of output.dialogue) {
      lines.push('');
      lines.push(dialogue.character);
      if (dialogue.parenthetical) {
        lines.push(`(${dialogue.parenthetical})`);
      }
      lines.push(dialogue.line);
    }

    // Transitions
    for (const transition of output.transitions || []) {
      lines.push('');
      lines.push(transition);
    }

    return lines.join('\n');
  }

  /**
   * Convert episode structure output to EpisodeStructure
   */
  private convertToEpisodeStructure(
    input: EpisodeGenerationInput,
    output: EpisodeStructureOutput
  ): EpisodeStructure {
    return {
      id: `${input.universeId}-S${input.seasonNumber}E${input.episodeNumber}`,
      number: input.episodeNumber,
      season: input.seasonNumber,
      title: output.title,
      summary: output.summary,
      scenes: output.scenes.map(s => ({
        number: s.number,
        location: s.location,
        characters: s.characters,
        summary: s.summary,
        type: s.type === 'transition' ? 'exposition' : s.type, // Map transition to exposition
        estimatedDuration: s.estimatedDuration,
      })),
      themes: output.themes,
      characterArcs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    } as EpisodeStructure;
  }

  /**
   * Create SceneGenerationInput array from episode structure
   */
  private createSceneInputs(
    episodeInput: EpisodeGenerationInput,
    episodeStructure: EpisodeStructure,
    context: GenerationContext
  ): SceneGenerationInput[] {
    return episodeStructure.scenes.map((scene, index) => ({
      universeId: episodeInput.universeId,
      episodeId: episodeStructure.id,
      sceneNumber: scene.number,
      location: scene.location,
      timeOfDay: 'day', // default since EpisodeStructure scene doesn't have timeOfDay
      characters: scene.characters,
      type: scene.type,
      estimatedDuration: scene.estimatedDuration,
      keyBeats: [], // Not available in EpisodeStructure
      previousSceneSummary: index > 0 ? episodeStructure.scenes[index - 1]?.summary : undefined,
    }));
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Abort a specific generation
   */
  abortGeneration(generationId: string): boolean {
    const controller = this.activeGenerations.get(generationId);
    if (controller) {
      controller.abort();
      this.activeGenerations.delete(generationId);
      return true;
    }
    return false;
  }

  /**
   * Abort all active generations
   */
  abortAllGenerations(): void {
    for (const controller of this.activeGenerations.values()) {
      controller.abort();
    }
    this.activeGenerations.clear();
  }

  /**
   * Get active generation count
   */
  getActiveGenerationCount(): number {
    return this.activeGenerations.size;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Create default orchestrator
 */
export function createDefaultOrchestrator(
  engineConfig: EngineConfig
): GenerationOrchestrator {
  const factory = createProviderFactory({
    anthropic: { apiKey: process.env['ANTHROPIC_API_KEY'] || '' },
    openai: { apiKey: process.env['OPENAI_API_KEY'] || '' },
  });
  
  const registry = ProviderRegistry.create(factory, createDefaultRegistryConfig());
  const promptRenderer = createDefaultRenderer();
  const config = createDefaultOrchestratorConfig(engineConfig, registry, promptRenderer);
  
  return new GenerationOrchestrator(config);
}