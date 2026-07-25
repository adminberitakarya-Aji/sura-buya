/**
 * @suro-buya/cli - Generate Season Command
 * 
 * Generate a season arc and episode breakdown using the engine core.
 */

import type { CommandDefinition } from '@suro-buya/engine-v2/commands.js';
import { BibleLoader, createBibleLoader, type BibleKey } from '@suro-buya/engine-v2/bible/loader.js';
import { BibleIndexer, createBibleIndexer } from '@suro-buya/engine-v2/bible/indexer.js';
import { ContextBuilder, createContextBuilder } from '@suro-buya/engine-v2/bible/context-builder.js';
import { GenerationOrchestrator, createDefaultOrchestrator } from '@suro-buya/engine-v2/generate/orchestrator.js';
import { EpisodePlanner, createDefaultEpisodePlanner } from '@suro-buya/engine-v2/plan/episode-planner.js';
import { SeasonPlanner, createDefaultSeasonPlanner } from '@suro-buya/engine-v2/plan/season-planner.js';
import { ProviderRegistry, createProviderFactory, createDefaultRegistryConfig } from '@suro-buya/engine-v2/ai/registry.js';
import type { EngineConfig, GenerationContext } from '@suro-buya/engine-v2/types.js';
import { readManifest } from '../utils/manifest.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Generate season command definition
 */
export const generateSeasonCommand: CommandDefinition = {
  name: 'generate:season',
  description: 'Generate a season arc and episode breakdown using engine core',
  usage: 'suro-buya generate:season <universe-id> <season>',
  aliases: ['g:season', 'gse'],
  options: [
    { name: 'title', alias: 't', description: 'Season title', type: 'string' },
    { name: 'arc', alias: 'a', description: 'Season arc summary', type: 'string' },
    { name: 'episodes', alias: 'e', description: 'Number of episodes', type: 'number', default: 10 },
    { name: 'characters', alias: 'c', description: 'Main characters (comma-separated)', type: 'string', required: true },
    { name: 'themes', description: 'Season themes (comma-separated)', type: 'string' },
    { name: 'model', alias: 'm', description: 'LLM model', type: 'string' },
    { name: 'temperature', description: 'Temperature', type: 'number', default: 0.3 },
    { name: 'universe-dir', description: 'Universe directory path', type: 'string', default: '.' },
  ],
  handler: async (args, options) => {
    const universeId = args[0];
    const season = parseInt(args[1] || '1');
    const universeDir = path.resolve(options['universe-dir'] as string);

    if (!universeId) {
      return {
        success: false,
        message: 'Usage: generate:season <universe-id> <season>',
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

      // Create episode planner
      const episodePlanner = createDefaultEpisodePlanner(orchestrator, providerRegistry);

      // Create season planner
      const seasonPlanner = createDefaultSeasonPlanner(episodePlanner, orchestrator, providerRegistry);

      // Plan season
      const characters = (options['characters'] as string).split(',').map(c => c.trim());
      const themes = (options['themes'] as string || '').split(',').map(t => t.trim()).filter(t => t);

      // Build generation context
      const context = await buildGenerationContext(manifest, bibleLoader, bibleIndexer, contextBuilder, universeId);

      // Generate season plan
      const seasonPlan = await seasonPlanner.generateSeasonPlan(universeId, season, context, {
        episodeCount: options['episodes'] as number,
        targetRuntimeMinutes: 22,
        arcType: 'serialized',
        themes,
        focusCharacters: characters,
        tone: 'adventure',
      });

      return {
        success: true,
        message: `Generated season ${season} with ${seasonPlan.episodes.length} episodes`,
        data: {
          universeId,
          season,
          title: options['title'] as string || `Season ${season}`,
          plan: seasonPlan,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Season generation failed: ${error}`,
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
    tone: 'adventure',
    themes: ['adventure'],
    genre: ['adventure'],
    audience: 'general',
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