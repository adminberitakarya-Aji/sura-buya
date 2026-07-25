/**
 * @suro-buya/cli - Validate Universe Command
 * 
 * Validate universe bible against canon rules using the engine core.
 */

import type { CommandDefinition } from '@suro-buya/engine-v2/commands.js';
import { 
  BibleLoader, 
  type BibleFile, 
  type BibleLoaderConfig 
} from '@suro-buya/engine-v2/bible/loader.js';
import { ContextBuilder } from '@suro-buya/engine-v2/bible/context-builder.js';
import { BibleIndexer } from '@suro-buya/engine-v2/bible/indexer.js';
import { 
  validateCanon, 
  type ValidationContext, 
  type CanonValidationResult, 
  type ValidationRule,
  type ValidationViolation 
} from '@suro-buya/engine-v2/validate.js';
import { readManifest, validateManifest } from '../utils/manifest.js';
import fs from 'fs-extra';
import path from 'path';
import type { CharacterProfile, WorldProfile, StoryProfile, EpisodeStructure, SceneData, UniverseConfig } from '@suro-buya/shared';

/**
 * Validate universe command definition
 */
export const validateUniverseCommand: CommandDefinition = {
  name: 'validate:universe',
  description: 'Validate universe bible against canon rules',
  usage: 'suro-buya validate:universe <universe-id>',
  aliases: ['vu', 'check-universe'],
  options: [
    { name: 'type', alias: 't', description: 'Content type (scene|episode|story|character|world|universe)', type: 'string', default: 'universe' },
    { name: 'strict', alias: 's', description: 'Strict validation mode', type: 'boolean', default: false },
    { name: 'file', alias: 'f', description: 'Specific file to validate', type: 'string' },
    { name: 'universe-dir', description: 'Universe directory path', type: 'string', default: '.' },
  ],
  handler: async (args, options) => {
    const universeId = args[0];
    const universeDir = path.resolve(options['universe-dir'] as string);
    const contentType = (options as Record<string, unknown>)['type'] as string;
    const strict = (options as Record<string, unknown>)['strict'] as boolean;
    const specificFile = (options as Record<string, unknown>)['file'] as string;

    if (!universeId) {
      return {
        success: false,
        message: 'Usage: validate:universe <universe-id>',
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

      // Validate manifest structure first
      const manifestValidation = validateManifest(manifest);
      if (!manifestValidation.valid) {
        return {
          success: false,
          message: `Invalid manifest: ${manifestValidation.errors.join(', ')}`,
        };
      }

      // Initialize engine components
      const bibleRoot = path.join(universeDir, manifest.bibleRoot);
      
      // Create BibleLoader with universe root
      const loaderConfig: Partial<BibleLoaderConfig> = {
        universeRoot: universeDir,
      };
      const bibleLoader = new BibleLoader(universeId, loaderConfig);
      
      // Create BibleIndexer
      const bibleIndexer = new BibleIndexer(universeId);
      const bibleFiles = await bibleLoader.loadUniverse();
      await bibleIndexer.build(bibleFiles);
      
      // Create ContextBuilder
      const contextBuilder = new ContextBuilder(bibleLoader, bibleIndexer);
      
      let validationReport: CanonValidationResult | { passed: boolean; issues: any[]; summary: { errors: number; warnings: number; info: number }; suggestions: never[] };

      if (specificFile) {
        // Validate specific file
        const filePath = path.join(universeDir, specificFile);
        if (!(await fs.pathExists(filePath))) {
          return {
            success: false,
            message: `File not found: ${specificFile}`,
          };
        }

        const content = await fs.readFile(filePath, 'utf-8');
        
        // Build validation context
        const context = await buildValidationContext(
          bibleLoader,
          bibleIndexer,
          contextBuilder,
          universeId,
          content,
          contentType as ValidationContext['contentType'],
          manifest
        );
        
        validationReport = await validateCanon(content, contentType as ValidationContext['contentType'], context, {
          strictMode: strict,
        });
      } else {
        // Full universe validation - validate all bible files
        const allFiles = await bibleLoader.loadUniverse();
        const reports: Array<{ file: string; report: CanonValidationResult }> = [];

        for (const file of allFiles) {
          const fileContentType = getContentTypeFromKey(file.key);
          
          const context = await buildValidationContext(
            bibleLoader,
            bibleIndexer,
            contextBuilder,
            universeId,
            file.content,
            fileContentType,
            manifest
          );
          
          const report = await validateCanon(file.content, fileContentType, context, {
            strictMode: strict,
          });
          reports.push({ file: file.relPath, report });
        }

        // Aggregate reports
        const totalErrors = reports.reduce((sum, r) => sum + r.report.errors.length, 0);
        const totalWarnings = reports.reduce((sum, r) => sum + r.report.warnings.length, 0);
        const totalInfo = reports.reduce((sum, r) => sum + r.report.infos.length, 0);

        validationReport = {
          passed: totalErrors === 0,
          issues: reports.flatMap(r => 
            [
              ...r.report.errors.map(e => ({ ...e, file: r.file, severity: 'error' as const })),
              ...r.report.warnings.map(w => ({ ...w, file: r.file, severity: 'warning' as const })),
              ...r.report.infos.map(i => ({ ...i, file: r.file, severity: 'info' as const })),
            ]
          ),
          summary: {
            errors: totalErrors,
            warnings: totalWarnings,
            info: totalInfo,
          },
          suggestions: [],
        };
      }

      const passed = 'passed' in validationReport ? validationReport.passed : validationReport.valid;
      const errors = 'summary' in validationReport ? validationReport.summary.errors : validationReport.errors.length;
      const warnings = 'summary' in validationReport ? validationReport.summary.warnings : validationReport.warnings.length;
      const info = 'summary' in validationReport ? validationReport.summary.info : validationReport.infos.length;

      let message = `Validation ${passed ? 'PASSED' : 'FAILED'} for universe "${universeId}"\n`;
      message += `Errors: ${errors}, Warnings: ${warnings}, Info: ${info}`;

      if (!passed && strict) {
        return {
          success: false,
          message,
          data: validationReport,
        };
      }

      return {
        success: true,
        message,
        data: validationReport,
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation failed: ${error}`,
      };
    }
  },
};

/**
 * Map bible key to content type
 */
function getContentTypeFromKey(key: string): ValidationContext['contentType'] {
  if (key.startsWith('character:')) return 'character';
  if (key.startsWith('region:')) return 'world';
  if (key === 'characterOverview' || key === 'voiceGuide' || key === 'relationshipDynamic') return 'character';
  if (key === 'episodeFormula' || key === 'seasonStructure') return 'episode';
  if (key === 'canonRules') return 'story';
  return 'story';
}

/**
 * Build validation context from bible files
 */
async function buildValidationContext(
  bibleLoader: BibleLoader,
  bibleIndexer: BibleIndexer,
  contextBuilder: ContextBuilder,
  universeId: string,
  content: string,
  contentType: ValidationContext['contentType'],
  manifest: any
): Promise<any> {
  // Load universe config
  const universeConfig = await loadUniverseConfig(bibleLoader, manifest);
  
  // Load character bibles
  const characterBibles: Record<string, CharacterProfile> = {};
  for (const char of manifest.characters) {
    const charFile = await bibleLoader.load(`character:${char.id}`);
    if (charFile) {
      characterBibles[char.id] = JSON.parse(charFile.content) as CharacterProfile;
    }
  }
  
  // Load world bibles
  const worldBibles: Record<string, WorldProfile> = {};
  for (const region of manifest.regions) {
    const worldFile = await bibleLoader.load(`region:${region.id}`);
    if (worldFile) {
      worldBibles[region.id] = JSON.parse(worldFile.content) as WorldProfile;
    }
  }
  
  // Load story profile
  const storyFile = await bibleLoader.load('custom:story');
  const storyProfile = storyFile ? JSON.parse(storyFile.content) as StoryProfile : createDefaultStoryProfile(universeId);
  
  // Create minimal episode structure
  const episodeStructure: EpisodeStructure = {
    id: 'ep-placeholder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    number: 1,
    season: 1,
    title: 'Validation Episode',
    summary: 'Validation placeholder',
    scenes: [],
    themes: [],
    characterArcs: [],
  };
  
  // Create minimal scene data
  const sceneData: SceneData = {
    id: 'scene-placeholder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    number: 1,
    episodeId: 'ep-placeholder',
    location: 'UNKNOWN',
    timeOfDay: 'DAY',
    characters: [],
    type: 'dialogue',
    beats: [],
    estimatedDuration: 1,
  };

  return {
    content,
    contentType,
    universeConfig,
    characterBibles,
    worldBibles,
    storyProfile,
    episodeStructure,
    sceneData,
  };
}

/**
 * Load universe config from bible
 */
async function loadUniverseConfig(bibleLoader: BibleLoader, manifest: any): Promise<UniverseConfig> {
  // Try to load from custom:universe or use defaults
  const universeFile = await bibleLoader.load('custom:universe');
  if (universeFile) {
    return JSON.parse(universeFile.content) as UniverseConfig;
  }
  
  // Fallback - create minimal config from manifest
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    locale: manifest.defaultLanguage,
    locales: [manifest.defaultLanguage, 'en-US'],
    timezone: 'Asia/Jakarta',
    metadata: {
      description: manifest.description,
      bibleRoot: manifest.bibleRoot,
      characters: manifest.characters,
      regions: manifest.regions,
      canonRules: manifest.canonRules,
      aiProviders: manifest.aiProviders,
      generationDefaults: manifest.generationDefaults,
    },
  };
}

/**
 * Create default story profile for validation
 */
function createDefaultStoryProfile(universeId: string): StoryProfile {
  return {
    id: 'story-placeholder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    title: 'Validation Story',
    type: 'series',
    logline: 'Validation placeholder story',
    synopsis: 'Validation placeholder',
    themes: [],
    genre: ['drama'],
    audience: 'general',
    tone: 'dramatic',
    structure: { acts: 3, beats: [] },
    characters: [],
    locations: [],
    plotPoints: [],
  };
}