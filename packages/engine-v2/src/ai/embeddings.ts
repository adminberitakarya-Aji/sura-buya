/**
 * Suro-Buya Engine v2 - Embedding Providers
 * 
 * Unified interface for multiple embedding providers (OpenAI, Cohere, Ollama, Local).
 */

import type { AIProviderOptions } from './providers.js';

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  /** Provider name */
  readonly name: string;
  
  /** Provider version */
  readonly version: string;
  
  /** Model identifier */
  readonly model: string;
  
  /** Embedding dimension */
  readonly dimensions: number;
  
  /** Generate embeddings for multiple texts */
  embed(texts: string[]): Promise<number[][]>;
  
  /** Generate embedding for single text */
  embedOne(text: string): Promise<number[]>;
  
  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
  
  /** Get model info */
  getModelInfo(): { name: string; dimensions: number; maxTokens: number };
}

/**
 * Embedding options
 */
export interface EmbeddingOptions extends AIProviderOptions {
  /** Model to use */
  model?: string;
  
  /** Input type (for some providers like Cohere) */
  inputType?: 'search_document' | 'search_query' | 'classification' | 'clustering';
  
  /** Truncate input if too long */
  truncate?: 'NONE' | 'START' | 'END';
  
  /** Batch size for processing */
  batchSize?: number;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** Embeddings (one per input text) */
  embeddings: number[][];
  
  /** Token usage */
  usage: {
    promptTokens: number;
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
 * Base Embedding Provider class
 */
export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly model: string;
  abstract readonly dimensions: number;

  abstract embed(texts: string[]): Promise<number[][]>;
  abstract isAvailable(): Promise<boolean>;
  abstract getModelInfo(): { name: string; dimensions: number; maxTokens: number };

  async embedOne(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0] || [];
  }

  /**
   * Estimate token count for text
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Process texts in batches
   */
  protected async processInBatches<T>(
    texts: string[],
    batchSize: number,
    processor: (batch: string[]) => Promise<T[]>
  ): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    return results;
  }
}

/**
 * OpenAI Embedding Provider
 * Supports text-embedding-3-small (1536 dim), text-embedding-3-large (3072 dim), text-embedding-ada-002 (1536 dim)
 */
export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'openai';
  readonly version = '1.0.0';
  
  readonly model: string;
  readonly dimensions: number;
  
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { 
    apiKey: string; 
    baseUrl?: string; 
    model?: string;
    dimensions?: number;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions || this.getDefaultDimensions(this.model);
  }

  private getDefaultDimensions(model: string): number {
    switch (model) {
      case 'text-embedding-3-large': return 3072;
      case 'text-embedding-3-small': return 1536;
      case 'text-embedding-ada-002': return 1536;
      default: return 1536;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      // Replace newlines with spaces (OpenAI recommendation)
      const processedTexts = texts.map(t => t.replace(/\n/g, ' '));
      
      const body: Record<string, unknown> = {
        model: this.model,
        input: processedTexts,
      };
      
      // Only add dimensions for v3 models
      if (this.model.startsWith('text-embedding-3')) {
        body['dimensions'] = this.dimensions;
      }
      
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(`OpenAI Embedding API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>;
        usage?: { prompt_tokens: number; total_tokens: number };
        model: string;
      };

      // Sort by index to maintain order
      const sortedData = data.data.sort((a, b) => a.index - b.index);
      const embeddings = sortedData.map(d => d.embedding);

      return embeddings;
    } catch (error) {
      throw new Error(`OpenAI embedding failed: ${(error as Error).message}`);
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

  getModelInfo(): { name: string; dimensions: number; maxTokens: number } {
    const maxTokensMap: Record<string, number> = {
      'text-embedding-3-small': 8191,
      'text-embedding-3-large': 8191,
      'text-embedding-ada-002': 8191,
    };
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: maxTokensMap[this.model] || 8191,
    };
  }
}

/**
 * Cohere Embedding Provider
 * Supports embed-multilingual-v3.0 (1024 dim), embed-english-v3.0 (1024 dim), embed-english-light-v3.0 (384 dim)
 */
export class CohereEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'cohere';
  readonly version = '1.0.0';
  
  readonly model: string;
  readonly dimensions: number;
  
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { 
    apiKey: string; 
    baseUrl?: string; 
    model?: string;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.cohere.ai/v1';
    this.model = config.model ?? 'embed-multilingual-v3.0';
    this.dimensions = this.getDefaultDimensions(this.model);
  }

  private getDefaultDimensions(model: string): number {
    switch (model) {
      case 'embed-multilingual-v3.0': return 1024;
      case 'embed-english-v3.0': return 1024;
      case 'embed-english-light-v3.0': return 384;
      case 'embed-multilingual-light-v3.0': return 384;
      default: return 1024;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          texts: texts,
          input_type: 'search_document',
          embedding_types: ['float'],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(`Cohere Embedding API error: ${response.status} - ${error.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        embeddings: { float: number[][] };
        meta?: { billed_units?: { input_tokens?: number } };
      };

      return data.embeddings.float ?? [];
    } catch (error) {
      throw new Error(`Cohere embedding failed: ${(error as Error).message}`);
    }
  }

  async embedQuery(texts: string[]): Promise<number[][]> {
    // For query embedding, use search_query input type
    try {
      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          texts: texts,
          input_type: 'search_query',
          embedding_types: ['float'],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(`Cohere Embedding API error: ${response.status} - ${error.message || 'Unknown error'}`);
      }

      const data = await response.json() as {
        embeddings: { float: number[][] };
      };

      return data.embeddings.float ?? [];
    } catch (error) {
      throw new Error(`Cohere query embedding failed: ${(error as Error).message}`);
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

  getModelInfo(): { name: string; dimensions: number; maxTokens: number } {
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: 512, // Cohere's typical max
    };
  }
}

/**
 * Ollama Embedding Provider (local)
 * Supports various models like nomic-embed-text, mxbai-embed-large, etc.
 */
export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'ollama';
  readonly version = '1.0.0';
  
  readonly model: string;
  readonly dimensions: number;
  
  private baseUrl: string;
  private knownDimensions: Map<string, number> = new Map([
    ['nomic-embed-text', 768],
    ['mxbai-embed-large', 1024],
    ['all-minilm', 384],
    ['bge-m3', 1024],
  ]);

  constructor(config: { 
    baseUrl?: string; 
    model?: string;
  }) {
    super();
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'nomic-embed-text';
    this.dimensions = this.knownDimensions.get(this.model) || 768;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    try {
      // Ollama embeddings API processes one at a time
      for (const text of texts) {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: text,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(`Ollama Embedding API error: ${response.status} - ${error.error || 'Unknown error'}`);
        }

        const data = await response.json() as { embedding?: number[] };
        if (data.embedding) {
          embeddings.push(data.embedding);
        }
      }

      return embeddings;
    } catch (error) {
      throw new Error(`Ollama embedding failed: ${(error as Error).message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;
      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelName = this.model.split(':')[0] ?? '';
      return data.models?.some(m => m.name.includes(modelName)) || false;
    } catch {
      return false;
    }
  }

  getModelInfo(): { name: string; dimensions: number; maxTokens: number } {
    return {
      name: this.model,
      dimensions: this.dimensions,
      maxTokens: 8192, // Varies by model
    };
  }
}

/**
 * Local Embedding Provider (using @xenova/transformers)
 * Runs entirely in-browser or Node.js without external API
 */
export class LocalEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'local';
  readonly version = '1.0.0';
  
  readonly model: string;
  readonly dimensions: number;
  
  private pipeline: unknown = null;
  private modelId: string;

  constructor(config: { 
    modelId?: string;
  } = {}) {
    super();
    this.modelId = config.modelId || 'Xenova/all-MiniLM-L6-v2';
    this.model = this.modelId;
    this.dimensions = 384; // all-MiniLM-L6-v2 dimension
  }

  private async loadPipeline(): Promise<void> {
    if (this.pipeline) return;
    
    try {
      // Dynamic import to avoid bundling issues
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', this.modelId);
    } catch (error) {
      throw new Error(`Failed to load local embedding model: ${(error as Error).message}. Make sure @xenova/transformers is installed.`);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    await this.loadPipeline();
    
    try {
      const extractor = this.pipeline as (texts: string[], options?: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array; shape: readonly number[] }>;
      
      const results = await extractor(texts, { pooling: 'mean', normalize: true });
      
      // Convert Float32Array to number[][]
      const embeddings: number[][] = [];
      const { data, shape } = results;
      const batchSize = shape[0] ?? 0;
      const dim = shape[1] ?? 0;
      
      for (let i = 0; i < batchSize; i++) {
        const start = i * dim;
        const end = start + dim;
        embeddings.push(Array.from(data.slice(start, end)));
      }
      
      return embeddings;
    } catch (error) {
      throw new Error(`Local embedding failed: ${(error as Error).message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.loadPipeline();
      return true;
    } catch {
      return false;
    }
  }

  getModelInfo(): { name: string; dimensions: number; maxTokens: number } {
    return {
      name: this.modelId,
      dimensions: this.dimensions,
      maxTokens: 256, // Typical for MiniLM
    };
  }
}

/**
 * Embedding Provider Factory
 */
export class EmbeddingProviderFactory {
  private providers: Map<string, EmbeddingProvider> = new Map();

  register(provider: EmbeddingProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): EmbeddingProvider | undefined {
    return this.providers.get(name);
  }

  list(): EmbeddingProvider[] {
    return Array.from(this.providers.values());
  }

  async getDefault(): Promise<EmbeddingProvider | null> {
    for (const provider of Array.from(this.providers.values())) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }
    return null;
  }

  createOpenAI(config: { apiKey: string; baseUrl?: string; model?: string; dimensions?: number }): OpenAIEmbeddingProvider {
    const provider = new OpenAIEmbeddingProvider(config);
    this.register(provider);
    return provider;
  }

  createCohere(config: { apiKey: string; baseUrl?: string; model?: string }): CohereEmbeddingProvider {
    const provider = new CohereEmbeddingProvider(config);
    this.register(provider);
    return provider;
  }

  createOllama(config: { baseUrl?: string; model?: string }): OllamaEmbeddingProvider {
    const provider = new OllamaEmbeddingProvider(config);
    this.register(provider);
    return provider;
  }

  createLocal(config: { modelId?: string } = {}): LocalEmbeddingProvider {
    const provider = new LocalEmbeddingProvider(config);
    this.register(provider);
    return provider;
  }
}

/**
 * Create embedding provider factory from config
 */
export interface EmbeddingFactoryConfig {
  openai?: { apiKey: string; baseUrl?: string; model?: string; dimensions?: number };
  cohere?: { apiKey: string; baseUrl?: string; model?: string };
  ollama?: { baseUrl?: string; model?: string };
  local?: { modelId?: string };
}

export function createEmbeddingFactory(config: EmbeddingFactoryConfig): EmbeddingProviderFactory {
  const factory = new EmbeddingProviderFactory();
  
  if (config.openai?.apiKey) {
    factory.createOpenAI(config.openai);
  }
  
  if (config.cohere?.apiKey) {
    factory.createCohere(config.cohere);
  }
  
  if (config.ollama?.baseUrl) {
    factory.createOllama(config.ollama);
  }
  
  if (config.local) {
    factory.createLocal(config.local);
  }
  
  return factory;
}

/**
 * Utility: Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Utility: Normalize vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map(v => v / norm);
}