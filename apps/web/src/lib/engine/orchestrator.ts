import {
  ProviderRegistry,
  createProviderFactory,
  createDefaultRenderer,
  type AITask as EngineAITask,
  type TaskProviderConfig,
  type EngineConfig,
} from '@suro-buya/engine-v2';
import { createDefaultRegistryConfig } from '@suro-buya/engine-v2/ai/registry.js';
import {
  GenerationOrchestrator,
  createDefaultOrchestratorConfig,
} from '@suro-buya/engine-v2/generate/orchestrator.js';
import type { AITask as DbAITask } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/encryption';

/** Maps the dashboard's AIConfig.task enum to engine-v2's AITask union. */
const DB_TASK_TO_ENGINE_TASK: Record<DbAITask, EngineAITask> = {
  CREATIVE_GENERATION: 'creative-generation',
  PLANNING: 'planning',
  VALIDATION: 'validation',
  EMBEDDING: 'embedding',
  IMAGE_PROMPT: 'image-prompt',
  CODE_GENERATION: 'code-generation',
};

const SUPPORTED_PROVIDERS = new Set(['anthropic', 'openai', 'ollama']);

export class UnconfiguredProviderError extends Error {
  constructor(task: string) {
    super(
      `No AI provider is configured for task "${task}" in this universe's settings. ` +
        `Go to Settings → AI Providers and configure a provider + API key first.`
    );
    this.name = 'UnconfiguredProviderError';
  }
}

const ENGINE_CONFIG: EngineConfig = {
  version: '2.0.0',
  defaultModel: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000,
  defaultTemperature: 0.7,
  requestTimeout: 90_000,
  maxRetries: 2,
};

/**
 * Build a ProviderRegistry wired to this universe's configured AI providers
 * (Settings → AI Providers). Throws UnconfiguredProviderError if nothing
 * usable is configured. Shared by the generation orchestrator and the canon
 * validator (which needs a 'validation'-task provider for its LLM judge).
 */
export async function buildProviderRegistryForUniverse(
  universeId: string
): Promise<ProviderRegistry> {
  const configs = await prisma.aIConfig.findMany({ where: { universeId } });

  if (configs.length === 0) {
    throw new UnconfiguredProviderError('creative-generation');
  }

  const factory = createProviderFactory();
  const registeredProviders = new Set<string>();
  const tasks: TaskProviderConfig[] = [];

  for (const config of configs) {
    const providerName = config.provider.toLowerCase();
    if (!SUPPORTED_PROVIDERS.has(providerName)) {
      // Skip providers the engine doesn't have a live implementation for
      // (e.g. 'cohere' is only wired for embeddings, not chat generation).
      continue;
    }

    if (!registeredProviders.has(providerName)) {
      const apiKey = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : undefined;
      if (providerName === 'anthropic') {
        if (!apiKey) continue;
        factory.createAnthropic({ apiKey, defaultModel: config.model });
      } else if (providerName === 'openai') {
        if (!apiKey) continue;
        factory.createOpenAI({ apiKey, defaultModel: config.model });
      } else if (providerName === 'ollama') {
        factory.createOllama({ defaultModel: config.model });
      }
      registeredProviders.add(providerName);
    }

    const engineTask = DB_TASK_TO_ENGINE_TASK[config.task as keyof typeof DB_TASK_TO_ENGINE_TASK];
    const parameters = (config.parameters as Record<string, unknown>) ?? {};

    tasks.push({
      task: engineTask,
      primary: { provider: providerName, model: config.model },
      parameters: {
        temperature: typeof parameters.temperature === 'number' ? parameters.temperature : 0.7,
        maxTokens: typeof parameters.maxTokens === 'number' ? parameters.maxTokens : 4000,
      },
      enabled: true,
    });
  }

  if (tasks.length === 0 || registeredProviders.size === 0) {
    throw new UnconfiguredProviderError('creative-generation');
  }

  const baseConfig = createDefaultRegistryConfig();
  const registryConfig = {
    tasks,
    defaults: {
      ...baseConfig.defaults,
      defaultProvider: tasks[0].primary.provider,
      defaultModel: tasks[0].primary.model,
    },
  };

  const registry = new ProviderRegistry(factory, registryConfig);
  for (const name of Array.from(registeredProviders)) {
    const provider = factory.get(name);
    if (provider) registry.registerProvider(name, provider);
  }

  return registry;
}

/**
 * Build a GenerationOrchestrator wired to this universe's configured AI
 * providers (as set in Settings → AI Providers). Throws
 * UnconfiguredProviderError if the universe has no CREATIVE_GENERATION
 * config, since that's the minimum needed for scene generation.
 */
export async function buildOrchestratorForUniverse(
  universeId: string
): Promise<GenerationOrchestrator> {
  const { orchestrator } = await buildOrchestratorAndRegistryForUniverse(universeId);
  return orchestrator;
}

/**
 * Same as buildOrchestratorForUniverse, but also returns the underlying
 * ProviderRegistry — useful for callers like EpisodePlanner that need both
 * (avoids building the registry, and re-decrypting API keys, twice).
 */
export async function buildOrchestratorAndRegistryForUniverse(
  universeId: string
): Promise<{ orchestrator: GenerationOrchestrator; registry: ProviderRegistry }> {
  const registry = await buildProviderRegistryForUniverse(universeId);
  const renderer = createDefaultRenderer();
  const orchestratorConfig = createDefaultOrchestratorConfig(ENGINE_CONFIG, registry, renderer);

  return { orchestrator: new GenerationOrchestrator(orchestratorConfig), registry };
}
