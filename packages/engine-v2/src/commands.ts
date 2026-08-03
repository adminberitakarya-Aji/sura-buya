/**
 * Suro-Buya Engine v2 - CLI Commands
 * 
 * Command definitions and handlers for the engine CLI.
 */

import type { CommandResult, EngineConfig, SceneGenerationInput, EpisodeGenerationInput, GenerationContext, EngineStatus } from './types.js';
const proc = typeof process !== 'undefined' ? process : ({} as any);

/**
 * Command handler type
 */
export type CommandHandler = (args: string[], options: Record<string, unknown>) => Promise<CommandResult>;

/**
 * Available commands
 */
export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  options?: CommandOption[];
  handler: CommandHandler;
}

/**
 * Command option definition
 */
export interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: unknown;
}

/**
 * Command registry
 */
export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>();

  /**
   * Register a command
   */
  register(command: CommandDefinition): void {
    this.commands.set(command.name, command);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * Get a command by name or alias
   */
  get(name: string): CommandDefinition | undefined {
    const commandName = this.aliases.get(name) ?? name;
    return this.commands.get(commandName);
  }

  /**
   * List all commands
   */
  list(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if command exists
   */
  has(name: string): boolean {
    return this.get(name) !== undefined;
  }
}

/**
 * Default engine configuration
 */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  version: '2.0.0',
  defaultModel: 'gpt-4',
  maxTokens: 4096,
  defaultTemperature: 0.7,
  requestTimeout: 120000,
  maxRetries: 3,
};

/**
 * Create default generation context
 */
export function createDefaultContext(universeId: string): GenerationContext {
  return {
    universeConfig: {
      id: universeId,
      name: 'Suro-Buya',
      version: '1.0.0',
      locale: 'id-ID',
      locales: ['id-ID', 'en-US'],
      timezone: 'Asia/Jakarta',
    },
    characterBibles: {},
    worldBibles: {},
    storyProfile: {
      id: 'origin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      title: 'Suro & Buya: Origin',
      type: 'series',
      logline: 'Two inventors journey across floating islands to save their world.',
      synopsis: 'Suro and Buya flee their failing home island...',
      themes: ['friendship', 'discovery', 'sacrifice'],
      genre: ['steampunk', 'fantasy', 'adventure'],
      audience: 'all-ages',
      tone: 'hopeful adventure',
      characters: ['suro', 'buya'],
      locations: ['aetheris'],
      plotPoints: [],
    },
    episodeStructure: {
      id: 's01e01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      number: 1,
      season: 1,
      title: 'The Fall of Home',
      summary: 'Suro detects Core instability. Home island begins falling. Professor reveals truth. Escape on sky-ship.',
      scenes: [],
      themes: ['loss', 'beginning', 'partnership'],
      characterArcs: ['suro: naive->determined', 'buya: carefree->resolute'],
    },
    previousScenes: [],
    characterStates: {},
    worldState: { coreStability: 'critical', timeOfDay: 'morning' },
  };
}

/**
 * Get engine status
 */
export function getEngineStatus(loadedUniverses: string[], activeGenerations: number): EngineStatus {
  return {
    version: DEFAULT_ENGINE_CONFIG.version,
    ready: true,
    loadedUniverses,
    activeGenerations,
    memoryUsage: proc.memoryUsage ? proc.memoryUsage().heapUsed / 1024 / 1024 : 0,
  };
}

/**
 * Built-in commands
 */
export const BUILTIN_COMMANDS: CommandDefinition[] = [
  {
    name: 'init',
    description: 'Initialize a new universe project',
    usage: 'suro-buya init [universe-id]',
    aliases: ['i'],
    options: [
      { name: 'template', alias: 't', description: 'Template to use', type: 'string', default: 'suro-buya' },
      { name: 'directory', alias: 'd', description: 'Target directory', type: 'string', default: '.' },
    ],
    handler: async (args) => {
      const universeId = args[0] || 'suro-buya';
      return {
        success: true,
        message: `Initialized universe: ${universeId}`,
        data: { universeId },
      };
    },
  },
  {
    name: 'generate:scene',
    description: 'Generate a scene',
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
    ],
    handler: async (args) => {
      const universeId = args[0] || 'suro-buya';
      const episodeId = args[1] || 's01e01';
      const sceneNumber = parseInt(args[2] || '1');
      return {
        success: true,
        message: `Generating scene ${sceneNumber} for episode ${episodeId}...`,
        data: { universeId, episodeId, sceneNumber },
      };
    },
  },
  {
    name: 'generate:episode',
    description: 'Generate an episode structure',
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
    ],
    handler: async (args) => {
      const universeId = args[0] || 'suro-buya';
      const season = parseInt(args[1] || '1');
      const episode = parseInt(args[2] || '1');
      return {
        success: true,
        message: `Generating episode ${episode} of season ${season}...`,
        data: { universeId, season, episode },
      };
    },
  },
  {
    name: 'validate',
    description: 'Validate content against canon',
    usage: 'suro-buya validate <universe-id> <file-path>',
    aliases: ['v', 'check'],
    options: [
      { name: 'type', alias: 't', description: 'Content type (scene|episode|story|character|world)', type: 'string', required: true },
      { name: 'strict', alias: 's', description: 'Strict mode', type: 'boolean', default: false },
    ],
    handler: async (args) => {
      return {
        success: true,
        message: `Validating ${args[1] || 'file'} as ${args[0] ? 'scene' : 'unknown'}...`,
        data: { universeId: args[0], filePath: args[1] },
      };
    },
  },
  {
    name: 'status',
    description: 'Show engine status',
    usage: 'suro-buya status',
    aliases: ['st'],
    options: [],
    handler: async () => {
      const status = getEngineStatus([], 0);
      return {
        success: true,
        message: `Engine v${status.version} - Ready: ${status.ready}`,
        data: status,
      };
    },
  },
  {
    name: 'help',
    description: 'Show help for a command',
    usage: 'suro-buya help [command]',
    aliases: ['h'],
    options: [],
    handler: async (args) => {
      return {
        success: true,
        message: 'Help command - use with command registry',
      };
    },
  },
];

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[]): { command: string; args: string[]; options: Record<string, unknown> } {
  const options: Record<string, unknown> = {};
  const args: string[] = [];
  let command = '';
  let parsingOptions = false;
  let currentOption = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    
    if (!parsingOptions && !arg.startsWith('-') && !command) {
      command = arg;
      continue;
    }
    
    if (arg.startsWith('--')) {
      parsingOptions = true;
      currentOption = arg.slice(2);
      if (i + 1 < argv.length) {
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          options[currentOption] = nextArg;
          i++;
          currentOption = '';
        } else {
          options[currentOption] = true;
          currentOption = '';
        }
      } else {
        options[currentOption] = true;
        currentOption = '';
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      parsingOptions = true;
      const chars = arg.slice(1);
      for (let j = 0; j < chars.length; j++) {
        const char = chars[j];
        if (!char) continue;
        if (j === chars.length - 1 && i + 1 < argv.length) {
          const nextArg = argv[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            options[char] = nextArg;
            i++;
          } else {
            options[char] = true;
          }
        } else {
          options[char] = true;
        }
      }
    } else if (arg) {
      args.push(arg);
    }
  }

  return { command, args, options };
}
