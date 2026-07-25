/**
 * @suro-buya/cli - Generate Episode Command
 * 
 * Generate an episode plan and all scenes using the engine core.
 */

import type { CommandDefinition } from '@suro-buya/engine-v2/commands.js';
import { BibleLoader, createBibleLoader, type BibleKey } from '@suro-buya/engine-v2/bible/loader.js';
import { BibleIndexer, createBibleIndexer } from '@suro-buya/engine-v2/bible/indexer.js';
import { ContextBuilder, createContextBuilder } from '@suro-buya/engine-v2/bible/context-builder.js';
import { GenerationOrchestrator, createDefaultOrchestrator } from '@suro-buya/engine-v2/generate/orchestrator.js';
import { ProviderRegistry, createProviderFactory, createDefaultRegistryConfig, type AITask } from '@suro-buya/engine-v2/ai/registry.js';
import { DEFAULT_TOKEN_BUDGETS } from '@suro-buya/engine-v2/bible/types.js';
import type { EngineConfig, SceneGenerationInput, EpisodeGenerationInput, GenerationContext, GenerationOptions, GeneratedEpisode } from '@suro-buya/engine-v2';
import { readManifest } from '../utils/manifest.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Generate episode command definition
 */
export const generateEpisodeCommand: CommandDefinition = {
  name: 'generate:episode',
  description: 'Generate an episode plan and all scenes using engine core',
  usage: 'suro-buya generate:episode <universe-id> <season> <episode>',
  aliases: ['g:episode', 'ge'],
  options: [
    { name: 'title', alias: 't', description: 'Episode title', type: 'string', required: true },
    { name: 'arc', alias: 'a', description: 'Story arc', type: 'string' },
    { name: 'characters', alias: 'c', description: 'Focus characters (comma-separated)', type: 'string', required: true },
    { name: 'plot-points', alias: 'p', description: 'Key plot points (comma-separated)', type: 'string' },
    { name: 'themes', description: 'Themes (comma-separated)', type: 'string' },
    { name: 'runtime', alias: 'r', description: 'Target runtime (minutes)', type: 'number', default: 22 },
    { name: 'scenes', alias: 's', description: 'Number of scenes', type: 'number', default: 5 },
    { name: 'model', alias: 'm', description: 'LLM model', type: 'string' },
    { name: 'temperature', description: 'Temperature', type: 'number', default: 0.3 },
    { name: 'universe-dir', description: 'Universe directory path', type: 'string', default: '.' },
  ],
  handler: async (args, options) => {
    const universeId = args[0];
    const season = parseInt(args[1] || '1');
    const episode = parseInt(args[2] || '1');
    const universeDir = path.resolve(options['universe-dir'] as string);

    if (!universeId) {
      return {
        success: false,
        message: 'Usage: generate:episode <universe-id> <season> <episode>',
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

      // Plan episode
      const characters = (options['characters'] as string).split(',').map(c => c.trim());
      const plotPoints = (options['plot-points'] as string || '').split(',').map(p => p.trim()).filter(p => p);
      const themes = (options['themes'] as string || '').split(',').map(t => t.trim()).filter(t => t);

      // Create episode generation input
      const episodeInput: EpisodeGenerationInput = {
        universeId,
        seasonNumber: season,
        episodeNumber: episode,
        title: options['title'] as string,
        storyArc: options['arc'] as string,
        focusCharacters: characters,
        keyPlotPoints: plotPoints.length > 0 ? plotPoints : [`Episode ${episode} of season ${season}`],
        themes: themes.length > 0 ? themes : manifest.story?.themes || ['adventure'],
        targetRuntime: options['runtime'] as number,
        sceneCount: options['scenes'] as number,
      };

      // Build context for episode
      const context = await buildGenerationContext(manifest, bibleLoader, bibleIndexer, contextBuilder, universeId);

      // Generate episode structure
      const structureResult = await orchestrator.generateEpisodeStructure(episodeInput, context);
      
      if (!structureResult.success || !structureResult.data) {
        return {
          success: false,
          message: `Episode structure generation failed: ${structureResult.error}`,
        };
      }

      const episodeStructure = structureResult.data.episode;

      // Generate each scene
      const generatedScenes = [];
      for (const scenePlan of episodeStructure.scenes) {
        const sceneInput: SceneGenerationInput = {
          universeId,
          episodeId: episodeStructure.id,
          sceneNumber: scenePlan.number,
          location: scenePlan.location,
          timeOfDay: 'day',
          characters: scenePlan.characters,
          type: scenePlan.type,
          estimatedDuration: scenePlan.estimatedDuration,
          keyBeats: [scenePlan.summary],
        };

        const sceneResult = await orchestrator.generateScene(sceneInput, context, {
          temperature: options['temperature'] as number,
          maxTokens: 2000,
          model: options['model'] as string,
        });

        if (sceneResult.success && sceneResult.data) {
          generatedScenes.push({
            number: scenePlan.number,
            location: scenePlan.location,
            characters: scenePlan.characters,
            content: sceneResult.data.content,
            usage: sceneResult.metadata,
          });
        }
      }

      return {
        success: true,
        message: `Generated episode ${episode} of season ${season} with ${generatedScenes.length} scenes`,
        data: {
          universeId,
          season,
          episode,
          title: options['title'],
          plan: episodeStructure,
          scenes: generatedScenes,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Episode generation failed: ${error}`,
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
  universeId: string
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
      id: `${universeId}-S${String(manifest.seasons?.[0]?.number || 1).padStart(2, '0')}E${String(manifest.episodes?.[0]?.number || 1).padStart(2, '0')}`,
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