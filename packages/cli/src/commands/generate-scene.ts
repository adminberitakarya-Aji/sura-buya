/**
 * @suro-buya/cli - Generate Scene Command
 * 
 * Generate a scene using the engine core.
 */

import type { CommandDefinition } from '@suro-buya/engine-v2/commands.js';
import { BibleLoader, createBibleLoader, type BibleKey } from '@suro-buya/engine-v2/bible/loader.js';
import { BibleIndexer, createBibleIndexer } from '@suro-buya/engine-v2/bible/indexer.js';
import { ContextBuilder, createContextBuilder } from '@suro-buya/engine-v2/bible/context-builder.js';
import { GenerationOrchestrator, createDefaultOrchestrator } from '@suro-buya/engine-v2/generate/orchestrator.js';
import { ProviderRegistry, createProviderFactory, createDefaultRegistryConfig } from '@suro-buya/engine-v2/ai/registry.js';
import type { EngineConfig, SceneGenerationInput, GenerationContext, GenerationOptions, GeneratedScene } from '@suro-buya/engine-v2';
import { readManifest } from '../utils/manifest.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Generate scene command definition
 */
export const generateSceneCommand: CommandDefinition = {
  name: 'generate:scene',
  description: 'Generate a scene using engine core',
  usage: 'suro-buya generate:scene <universe-id> <episode-id> <scene-number>',
  aliases: ['g:scene', 'gs'],
  options: [
    { name: 'location', alias: 'l', description: 'Scene location', type: 'string', required: true },
    { name: 'time', description: 'Time of day', type: 'string', required: true },
    { name: 'characters', alias: 'c', description: 'Characters (comma-separated)', type: 'string', required: true },
    { name: 'type', description: 'Scene type', type: 'string', default: 'exposition' },
    { name: 'duration', description: 'Estimated duration (minutes)', type: 'number', default: 5 },
    { name: 'beats', alias: 'b', description: 'Key beats (comma-separated)', type: 'string' },
    { name: 'model', alias: 'm', description: 'LLM model', type: 'string' },
    { name: 'temperature', description: 'Temperature', type: 'number', default: 0.7 },
    { name: 'universe-dir', description: 'Universe directory path', type: 'string', default: '.' },
  ],
  handler: async (args, options) => {
    const universeId = args[0];
    const episodeId = args[1];
    const sceneNumber = parseInt(args[2] || '1');
    const universeDir = path.resolve(options['universe-dir'] as string);

    if (!universeId || !episodeId) {
      return {
        success: false,
        message: 'Usage: generate:scene <universe-id> <episode-id> <scene-number>',
      };
    }

    try {
      // Load universe manifest
      const manifest = await readManifest(universeDir);
      if (!manifest) {
        return {
          success: false,
          message: `No universe.yaml found in ${universeDir}`,
        };
      }

      // Check if universe ID matches
      if (manifest.id !== universeId) {
        return {
          success: false,
          message: `Universe ID mismatch: manifest has "${manifest.id}", expected "${universeId}"`,
        };
      }

      // Convert manifest to engine config
      const engineConfig = manifestToEngineConfig(manifest);

      // Initialize bible loader
      const bibleLoader = createBibleLoader(universeId, {
        universeRoot: path.join(universeDir, manifest.bibleRoot),
        whitelist: [
          'characterOverview',
          'canonRules',
          'voiceGuide',
          'relationshipDynamic',
          'episodeFormula',
          'seasonStructure',
          ...manifest.characters.map(c => `character:${c.id}` as BibleKey),
          ...manifest.regions.map(r => `region:${r.id}` as BibleKey),
        ],
        cacheEnabled: true,
        maxFileSize: 1024 * 1024,
      });

      // Load bible files and build index
      const bibleFiles = await bibleLoader.loadUniverse();
      const bibleIndexer = createBibleIndexer(universeId);
      await bibleIndexer.build(bibleFiles);

      // Create context builder
      const contextBuilder = createContextBuilder(bibleLoader, bibleIndexer);

      // Create provider registry
      const factory = createProviderFactory({
        anthropic: { apiKey: process.env['ANTHROPIC_API_KEY'] || '' },
        openai: { apiKey: process.env['OPENAI_API_KEY'] || '' },
      });
      const providerRegistry = ProviderRegistry.create(factory, createDefaultRegistryConfig());

      // Create orchestrator
      const orchestrator = createDefaultOrchestrator(engineConfig);

      // Build SceneGenerationInput
      const characters = (options['characters'] as string).split(',').map(c => c.trim());
      const beats = (options['beats'] as string || '').split(',').map(b => b.trim()).filter(b => b);
      
      const sceneInput: SceneGenerationInput = {
        universeId,
        episodeId,
        sceneNumber,
        location: options['location'] as string,
        timeOfDay: options['time'] as string,
        characters,
        type: (options['type'] as 'exposition' | 'dialogue' | 'action' | 'climax' | 'resolution' | 'transition') || 'exposition',
        estimatedDuration: options['duration'] as number,
        keyBeats: beats,
        previousSceneSummary: undefined,
      };

      // Build generation context
      const context = await buildGenerationContext(manifest, bibleLoader, bibleIndexer, contextBuilder, universeId, episodeId);

      // Build scene-specific context
      const sceneContext = await contextBuilder.buildSceneContext(sceneInput, context);

      // Generate scene
      const genOptions: GenerationOptions = {
        temperature: options['temperature'] as number,
        maxTokens: 2000,
        model: options['model'] as string,
      };
      
      const result = await orchestrator.generateScene(sceneInput, context, genOptions);

      if (!result.success || !result.data) {
        return {
          success: false,
          message: `Scene generation failed: ${result.error}`,
        };
      }

      return {
        success: true,
        message: `Generated scene ${sceneNumber} for episode ${episodeId}`,
        data: {
          universeId,
          episodeId,
          sceneNumber,
          content: result.data.content,
          usage: result.metadata,
          model: result.metadata.model,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Scene generation failed: ${error}`,
      };
    }
  },
};

/**
 * Build generation context from manifest and bibles
 */
async function buildGenerationContext(
  manifest: any,
  bibleLoader: BibleLoader,
  bibleIndexer: BibleIndexer,
  contextBuilder: ContextBuilder,
  universeId: string,
  episodeId: string
): Promise<GenerationContext> {
  // Load core bible files
  const [characterOverview, canonRules, voiceGuide, episodeFormula, seasonStructure, relationshipDynamic] = await Promise.all([
    bibleLoader.load('characterOverview'),
    bibleLoader.load('canonRules'),
    bibleLoader.load('voiceGuide'),
    bibleLoader.load('episodeFormula'),
    bibleLoader.load('seasonStructure'),
    bibleLoader.load('relationshipDynamic'),
  ]);

  // Load character bibles
  const characterBibles: Record<string, any> = {};
  for (const char of manifest.characters) {
    const bible = await bibleLoader.load(`character:${char.id}` as BibleKey);
    if (bible) {
      characterBibles[char.id] = {
        id: char.id,
        name: char.displayName || char.name,
        archetype: char.role,
        description: bible.content,
        voice: { tone: 'neutral' },
      };
    }
  }

  // Load world bibles
  const worldBibles: Record<string, any> = {};
  for (const region of manifest.regions) {
    const bible = await bibleLoader.load(`region:${region.id}` as BibleKey);
    if (bible) {
      worldBibles[region.id] = {
        id: region.id,
        name: region.name,
        description: bible.content,
      };
    }
  }

  // Build universe config
  const universeConfig = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    locale: manifest.defaultLanguage || 'id',
    locales: [manifest.defaultLanguage || 'id', 'en-US'],
    timezone: 'Asia/Jakarta',
    bibleRoot: manifest.bibleRoot,
    defaultLanguage: manifest.defaultLanguage,
    aiProviders: manifest.aiProviders,
  };

  // Build story profile
  const storyProfile = {
    id: `${universeId}-story`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1 as const,
    title: manifest.name,
    type: 'series' as const,
    logline: manifest.description || '',
    synopsis: manifest.description || '',
    tone: manifest.story?.tone || 'adventure',
    themes: manifest.story?.themes || ['adventure'],
    genre: ['adventure'],
    audience: manifest.targetAudience || 'general',
    characters: manifest.characters.map((c: { id: string }) => c.id),
    locations: manifest.regions.map((r: { id: string }) => r.id),
    plotPoints: [],
  };

  return {
    universeConfig,
    characterBibles,
    worldBibles,
    storyProfile,
    episodeStructure: {
      id: `${universeId}-${episodeId}`,
      number: 1,
      season: 1,
      title: 'Episode',
      summary: '',
      scenes: [],
      themes: [],
      characterArcs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    previousScenes: [],
    characterStates: {},
    worldState: {},
  };
}

/**
 * Convert manifest to engine config
 */
function manifestToEngineConfig(manifest: any): EngineConfig {
  return {
    version: manifest.version || '0.1.0',
    defaultModel: 'claude-3-sonnet',
    maxTokens: 4000,
    defaultTemperature: 0.3,
    requestTimeout: 60000,
    maxRetries: 3,
  };
}