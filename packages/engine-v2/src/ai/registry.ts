/**
 * Suro-Buya Engine v2 - Provider Registry
 * 
 * Task→provider routing, fallback logic, and provider management.
 */

import type { AIProvider, AIProviderOptions, AIResponse } from './providers.js';
import { AIProviderFactory } from './providers.js';

/**
 * AI Task types for routing
 */
export type AITask = 
  | 'creative-generation'    // Scene/episode writing (high creativity)
  | 'planning'               // Episode/season planning (structured output)
  | 'validation'             // Canon checking, quality scoring (low temp)
  | 'embedding'              // Vector embeddings for search
  | 'image-prompt'           // Image generation prompts
  | 'code-generation'        // Code/scripts generation
  | 'analysis'               // Content analysis, summarization
  | 'translation';           // Multi-language support

/**
 * Provider configuration for a specific task
 */
export interface TaskProviderConfig {
  task: AITask;
  primary: ProviderSpec;
  fallback?: ProviderSpec;
  parameters?: Partial<AIProviderOptions>;
  enabled: boolean;
}

export interface ProviderSpec {
  provider: string;        // Provider name (e.g., 'anthropic', 'openai', 'ollama')
  model: string;           // Model identifier
  apiKeyRef?: string;      // Reference to encrypted API key
}

/**
 * Provider registry configuration
 */
export interface ProviderRegistryConfig {
  tasks: TaskProviderConfig[];
  defaults: {
    defaultProvider: string;
    defaultModel: string;
    timeout: number;
    maxRetries: number;
  };
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: string;
  model: string;
  healthy: boolean;
  lastCheck: Date;
  latencyMs?: number;
  error?: string;
}

/**
 * Provider selection result
 */
export interface ProviderSelection {
  provider: AIProvider;
  config: TaskProviderConfig;
  isFallback: boolean;
}

/**
 * Provider Registry - manages provider routing and fallback
 */
export class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private taskConfigs: Map<AITask, TaskProviderConfig> = new Map();
  private healthCache: Map<string, ProviderHealth> = new Map();
  private factory: AIProviderFactory;
  private defaults: ProviderRegistryConfig['defaults'];

  constructor(factory: AIProviderFactory, config: ProviderRegistryConfig) {
    this.factory = factory;
    this.defaults = config.defaults;
    
    // Register task configurations
    for (const taskConfig of config.tasks) {
      this.taskConfigs.set(taskConfig.task, taskConfig);
    }
  }

  /**
   * Register a provider instance
   */
  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * List all registered providers
   */
  listProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider configuration for a task
   */
  getTaskConfig(task: AITask): TaskProviderConfig | undefined {
    return this.taskConfigs.get(task);
  }

  /**
   * Set/update task configuration
   */
  setTaskConfig(config: TaskProviderConfig): void {
    this.taskConfigs.set(config.task, config);
  }

  /**
   * Select the best provider for a task with automatic fallback
   */
  async selectProvider(task: AITask, options: Partial<AIProviderOptions> = {}): Promise<ProviderSelection> {
    const taskConfig = this.taskConfigs.get(task);
    
    if (!taskConfig || !taskConfig.enabled) {
      // Use default provider
      const defaultProvider = this.getDefaultProvider();
      if (!defaultProvider) {
        throw new Error(`No provider available for task: ${task}`);
      }
      return {
        provider: defaultProvider,
        config: {
          task,
          primary: { provider: defaultProvider.name, model: this.defaults.defaultModel },
          enabled: true,
        },
        isFallback: false,
      };
    }

    // Try primary provider
    const primaryProvider = this.getProviderBySpec(taskConfig.primary);
    if (primaryProvider && await this.isHealthy(primaryProvider)) {
      return {
        provider: primaryProvider,
        config: taskConfig,
        isFallback: false,
      };
    }

    // Try fallback provider
    if (taskConfig.fallback) {
      const fallbackProvider = this.getProviderBySpec(taskConfig.fallback);
      if (fallbackProvider && await this.isHealthy(fallbackProvider)) {
        return {
          provider: fallbackProvider,
          config: taskConfig,
          isFallback: true,
        };
      }
    }

    // Try any available provider as last resort
    for (const provider of Array.from(this.providers.values())) {
      if (await this.isHealthy(provider)) {
        return {
          provider,
          config: taskConfig,
          isFallback: true,
        };
      }
    }

    throw new Error(`No healthy provider available for task: ${task}`);
  }

  /**
   * Generate with automatic provider selection and fallback
   */
  async generate(
    task: AITask,
    prompt: string,
    options: Partial<AIProviderOptions> = {}
  ): Promise<AIResponse> {
    const selection = await this.selectProvider(task, options);
    const taskConfig = this.taskConfigs.get(task);
    
    const mergedOptions: AIProviderOptions = {
      model: selection.isFallback && taskConfig?.fallback 
        ? taskConfig.fallback.model 
        : taskConfig?.primary.model || this.defaults.defaultModel,
      temperature: options.temperature ?? taskConfig?.parameters?.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? taskConfig?.parameters?.maxTokens,
      systemPrompt: options.systemPrompt,
      topP: options.topP ?? taskConfig?.parameters?.topP,
      stop: options.stop ?? taskConfig?.parameters?.stop,
      seed: options.seed ?? taskConfig?.parameters?.seed,
    };

    let lastError: Error | null = null;
    const maxRetries = this.defaults.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await selection.provider.generate(prompt, mergedOptions);
        
        if (response.finishReason === 'error') {
          throw new Error(`Generation failed: ${response.content}`);
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // If this was the primary, try fallback on next attempt
        if (!selection.isFallback && taskConfig?.fallback && attempt === 0) {
          const fallbackSelection = await this.selectProvider(task, options);
          if (fallbackSelection.isFallback) {
            selection.provider = fallbackSelection.provider;
            selection.isFallback = true;
            mergedOptions.model = taskConfig.fallback.model;
            continue;
          }
        }
        
        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Stream generate with automatic provider selection and fallback
   */
  async *generateStream(
    task: AITask,
    prompt: string,
    options: Partial<AIProviderOptions> = {}
  ): AsyncIterable<string> {
    const selection = await this.selectProvider(task, options);
    const taskConfig = this.taskConfigs.get(task);
    
    const mergedOptions: AIProviderOptions = {
      model: selection.isFallback && taskConfig?.fallback
        ? taskConfig.fallback.model
        : taskConfig?.primary.model || this.defaults.defaultModel,
      temperature: options.temperature ?? taskConfig?.parameters?.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? taskConfig?.parameters?.maxTokens,
      systemPrompt: options.systemPrompt,
      topP: options.topP ?? taskConfig?.parameters?.topP,
      stop: options.stop ?? taskConfig?.parameters?.stop,
      seed: options.seed ?? taskConfig?.parameters?.seed,
    };

    let lastError: Error | null = null;
    const maxRetries = this.defaults.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        for await (const chunk of selection.provider.generateStream(prompt, mergedOptions)) {
          yield chunk;
        }
        return; // Success
      } catch (error) {
        lastError = error as Error;
        
        // Try fallback on first failure
        if (!selection.isFallback && taskConfig?.fallback && attempt === 0) {
          const fallbackSelection = await this.selectProvider(task, options);
          if (fallbackSelection.isFallback) {
            selection.provider = fallbackSelection.provider;
            selection.isFallback = true;
            mergedOptions.model = taskConfig.fallback.model;
            continue;
          }
        }
        
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Stream generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Check provider health
   */
  async checkHealth(providerName: string, model?: string): Promise<ProviderHealth> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        provider: providerName,
        model: model || 'unknown',
        healthy: false,
        lastCheck: new Date(),
        error: 'Provider not registered',
      };
    }

    const cacheKey = `${providerName}:${model || 'default'}`;
    const cached = this.healthCache.get(cacheKey);
    
    // Cache for 30 seconds
    if (cached && Date.now() - cached.lastCheck.getTime() < 30000) {
      return cached;
    }

    const startTime = Date.now();
    try {
      const healthy = await provider.isAvailable();
      const latency = Date.now() - startTime;
      
      const health: ProviderHealth = {
        provider: providerName,
        model: model || 'default',
        healthy,
        lastCheck: new Date(),
        latencyMs: healthy ? latency : undefined,
      };
      
      this.healthCache.set(cacheKey, health);
      return health;
    } catch (error) {
      const health: ProviderHealth = {
        provider: providerName,
        model: model || 'default',
        healthy: false,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
      
      this.healthCache.set(cacheKey, health);
      return health;
    }
  }

  /**
   * Check health of all providers
   */
  async checkAllHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];
    for (const provider of Array.from(this.providers.values())) {
      results.push(await this.checkHealth(provider.name));
    }
    return results;
  }

  /**
   * Get provider by spec (from registered providers)
   */
  private getProviderBySpec(spec: ProviderSpec): AIProvider | undefined {
    return this.providers.get(spec.provider);
  }

  /**
   * Get default provider
   */
  private getDefaultProvider(): AIProvider | undefined {
    return this.providers.get(this.defaults.defaultProvider) || this.providers.values().next().value;
  }

  /**
   * Check if provider is healthy
   */
  private async isHealthy(provider: AIProvider): Promise<boolean> {
    try {
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create registry from configuration
   */
  static create(factory: AIProviderFactory, config: ProviderRegistryConfig): ProviderRegistry {
    return new ProviderRegistry(factory, config);
  }
}

/**
 * Default provider registry configuration
 */
export function createDefaultRegistryConfig(): ProviderRegistryConfig {
  return {
    tasks: [
      {
        task: 'creative-generation',
        primary: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        fallback: { provider: 'openai', model: 'gpt-4o-2024-08-06' },
        parameters: { temperature: 0.7, maxTokens: 4000 },
        enabled: true,
      },
      {
        task: 'planning',
        primary: { provider: 'openai', model: 'gpt-4o-2024-08-06' },
        fallback: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        parameters: { temperature: 0.3, maxTokens: 4000 },
        enabled: true,
      },
      {
        task: 'validation',
        primary: { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
        fallback: { provider: 'openai', model: 'gpt-4o-mini-2024-07-18' },
        parameters: { temperature: 0.1, maxTokens: 2000 },
        enabled: true,
      },
      {
        task: 'embedding',
        primary: { provider: 'cohere', model: 'embed-multilingual-v3.0' },
        fallback: { provider: 'openai', model: 'text-embedding-3-small' },
        parameters: {},
        enabled: true,
      },
      {
        task: 'image-prompt',
        primary: { provider: 'openai', model: 'gpt-4o-2024-08-06' },
        fallback: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        parameters: { temperature: 0.5, maxTokens: 1000 },
        enabled: true,
      },
      {
        task: 'code-generation',
        primary: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        fallback: { provider: 'openai', model: 'gpt-4o-2024-08-06' },
        parameters: { temperature: 0.2, maxTokens: 4000 },
        enabled: true,
      },
      {
        task: 'analysis',
        primary: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        fallback: { provider: 'openai', model: 'gpt-4o-2024-08-06' },
        parameters: { temperature: 0.3, maxTokens: 2000 },
        enabled: true,
      },
      {
        task: 'translation',
        primary: { provider: 'openai', model: 'gpt-4o-2024-08-06' },
        fallback: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        parameters: { temperature: 0.3, maxTokens: 2000 },
        enabled: true,
      },
    ],
    defaults: {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-5-sonnet-20241022',
      timeout: 60000,
      maxRetries: 2,
    },
  };
}

/**
 * Create provider factory from environment/config
 */
export interface ProviderFactoryConfig {
  anthropic?: { apiKey: string; baseUrl?: string };
  openai?: { apiKey: string; baseUrl?: string };
  cohere?: { apiKey: string; baseUrl?: string };
  ollama?: { baseUrl?: string };
}

export function createProviderFactory(config: ProviderFactoryConfig): AIProviderFactory {
  const factory = new AIProviderFactory();
  
  if (config.anthropic?.apiKey) {
    factory.createAnthropic({
      apiKey: config.anthropic.apiKey,
      baseUrl: config.anthropic.baseUrl,
    });
  }
  
  if (config.openai?.apiKey) {
    factory.createOpenAI({
      apiKey: config.openai.apiKey,
      baseUrl: config.openai.baseUrl,
    });
  }
  
  if (config.ollama?.baseUrl) {
    factory.createOllama({
      baseUrl: config.ollama.baseUrl,
    });
  }
  
  return factory;
}
