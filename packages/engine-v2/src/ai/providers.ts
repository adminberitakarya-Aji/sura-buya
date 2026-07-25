/**
 * Suro-Buya Engine v2 - AI Providers
 * 
 * Unified interface for multiple LLM providers (OpenAI, Anthropic, Ollama).
 */

import type { GenerationOptions } from '../generate.js';

/**
 * AI Provider interface
 */
export interface AIProvider {
  /** Provider name */
  readonly name: string;
  
  /** Provider version */
  readonly version: string;
  
  /** Generate completion */
  generate(prompt: string, options: GenerationOptions): Promise<AIResponse>;
  
  /** Generate streaming completion */
  generateStream(prompt: string, options: GenerationOptions): AsyncIterable<string>;
  
  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
  
  /** Get available models */
  getModels(): Promise<string[]>;
}

/**
 * Generation options
 */
export interface AIProviderOptions extends GenerationOptions {
  /** Model to use */
  model?: string;
  
  /** System prompt */
  systemPrompt?: string;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Temperature (0-2) */
  temperature?: number;
  
  /** Top-p sampling */
  topP?: number;
  
  /** Stop sequences */
  stop?: string[];
  
  /** Seed for reproducibility */
  seed?: number;
}

/**
 * AI Response
 */
export interface AIResponse {
  /** Generated text */
  content: string;
  
  /** Finish reason */
  finishReason: 'stop' | 'length' | 'content_filter' | 'error' | 'unknown';
  
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** Model used */
  model: string;
  
  /** Provider name */
  provider: string;
  
  /** Latency in ms */
  latency: number;
}

/**
 * Base AI Provider class
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly version: string;

  abstract generate(prompt: string, options: AIProviderOptions): Promise<AIResponse>;
  abstract generateStream(prompt: string, options: AIProviderOptions): AsyncIterable<string>;
  abstract isAvailable(): Promise<boolean>;
  abstract getModels(): Promise<string[]>;

  /**
   * Build messages array from prompt and system prompt
   */
  protected buildMessages(prompt: string, systemPrompt?: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    return messages;
  }

  /**
   * Estimate token count
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  readonly version = '1.0.0';
  
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.defaultModel = config.defaultModel || 'gpt-4';
  }

  async generate(prompt: string, options: AIProviderOptions): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: this.buildMessages(prompt, options.systemPrompt),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          top_p: options.topP,
          stop: options.stop,
          seed: options.seed,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string }; finish_reason: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        model: string;
      };
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No choices returned from OpenAI');
      }

      return {
        content: choice.message.content || '',
        finishReason: this.mapFinishReason(choice.finish_reason),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model,
        provider: this.name,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        content: '',
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: options.model || this.defaultModel,
        provider: this.name,
        latency: Date.now() - startTime,
      };
    }
  }

  async *generateStream(prompt: string, options: AIProviderOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: this.buildMessages(prompt, options.systemPrompt),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stop,
        seed: options.seed,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return [];
      const data = await response.json() as { data?: Array<{ id: string }> };
      return data.data
        ?.filter((m) => m.id.includes('gpt'))
        .map((m) => m.id)
        .sort() || [];
    } catch {
      return [];
    }
  }

  private mapFinishReason(reason: string): AIResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      default: return 'unknown';
    }
  }
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'anthropic';
  readonly version = '1.0.0';
  
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.defaultModel = config.defaultModel || 'claude-3-opus-20240229';
  }

  async generate(prompt: string, options: AIProviderOptions): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: this.buildMessages(prompt, options.systemPrompt).map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })).filter(m => m.role !== 'system'),
          system: options.systemPrompt,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
          top_p: options.topP,
          stop_sequences: options.stop,
          stream: false,
        }),
      });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      stop_reason: string;
      usage?: { input_tokens: number; output_tokens: number };
      model: string;
    };
    const content = data.content[0]?.text || '';

      return {
        content,
        finishReason: this.mapFinishReason(data.stop_reason),
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        model: data.model,
        provider: this.name,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        content: '',
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: options.model || this.defaultModel,
        provider: this.name,
        latency: Date.now() - startTime,
      };
    }
  }

  async *generateStream(prompt: string, options: AIProviderOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: this.buildMessages(prompt, options.systemPrompt).map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })).filter(m => m.role !== 'system'),
        system: options.systemPrompt,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP,
        stop_sequences: options.stop,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield parsed.delta.text;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ];
  }

  private mapFinishReason(reason: string): AIResponse['finishReason'] {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'stop_sequence': return 'stop';
      default: return 'unknown';
    }
  }
}

/**
 * Ollama Provider (local)
 */
export class OllamaProvider extends BaseAIProvider {
  readonly name = 'ollama';
  readonly version = '1.0.0';
  
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { baseUrl?: string; defaultModel?: string }) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaultModel = config.defaultModel || 'llama3';
  }

  async generate(prompt: string, options: AIProviderOptions): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: this.buildMessages(prompt, options.systemPrompt),
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens,
            top_p: options.topP,
            stop: options.stop,
            seed: options.seed,
          },
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(`Ollama API error: ${response.status} - ${error.error || 'Unknown error'}`);
      }

      const data = await response.json() as {
        message?: { content: string };
        done: boolean;
        prompt_eval_count?: number;
        eval_count?: number;
        model: string;
      };
      const content = data.message?.content || '';

      return {
        content,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        model: data.model,
        provider: this.name,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        content: '',
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: options.model || this.defaultModel,
        provider: this.name,
        latency: Date.now() - startTime,
      };
    }
  }

  async *generateStream(prompt: string, options: AIProviderOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: this.buildMessages(prompt, options.systemPrompt),
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens,
          top_p: options.topP,
          stop: options.stop,
          seed: options.seed,
        },
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json() as { models?: Array<{ name: string }> };
      return data.models?.map((m) => m.name) || [];
    } catch {
      return [];
    }
  }
}

/**
 * Provider factory
 */
export class AIProviderFactory {
  private providers: Map<string, AIProvider> = new Map();

  /**
   * Register a provider
   */
  register(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a provider by name
   */
  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get default provider (first available)
   */
  async getDefault(): Promise<AIProvider | null> {
    for (const provider of Array.from(this.providers.values())) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }
    return null;
  }

  /**
   * List all registered providers
   */
  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Create OpenAI provider
   */
  createOpenAI(config: { apiKey: string; baseUrl?: string; defaultModel?: string }): OpenAIProvider {
    const provider = new OpenAIProvider(config);
    this.register(provider);
    return provider;
  }

  /**
   * Create Anthropic provider
   */
  createAnthropic(config: { apiKey: string; baseUrl?: string; defaultModel?: string }): AnthropicProvider {
    const provider = new AnthropicProvider(config);
    this.register(provider);
    return provider;
  }

  /**
   * Create Ollama provider
   */
  createOllama(config: { baseUrl?: string; defaultModel?: string }): OllamaProvider {
    const provider = new OllamaProvider(config);
    this.register(provider);
    return provider;
  }
}

/**
 * Create provider factory
 */
export function createProviderFactory(): AIProviderFactory {
  return new AIProviderFactory();
}