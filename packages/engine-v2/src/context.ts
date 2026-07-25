/**
 * Suro-Buya Engine v2 - Context Module
 * 
 * Context management for universe, character, world, and story data.
 */

import type { 
  GenerationContext, 
  UniverseConfig, 
  CharacterProfile, 
  WorldProfile, 
  StoryProfile, 
  EpisodeStructure,
  SceneData 
} from './types.js';
import { readJsonFile, readYamlFile, listFiles, ensureDir } from '@suro-buya/shared';

/**
 * Context loader options
 */
export interface ContextLoaderOptions {
  /** Universe directory path */
  universeDir: string;
  /** Enable caching */
  cache?: boolean;
}

/**
 * Loaded universe context
 */
export interface UniverseContext {
  /** Universe configuration */
  config: UniverseConfig;
  
  /** Character bibles */
  characters: Record<string, CharacterProfile>;
  
  /** World bibles */
  worlds: Record<string, WorldProfile>;
  
  /** Story profile */
  story: StoryProfile;
  
  /** Episodes */
  episodes: Record<string, EpisodeStructure>;
  
  /** Scenes */
  scenes: Record<string, SceneData>;
}

/**
 * Load universe context from directory
 */
export async function loadUniverseContext(
  universeId: string,
  options: ContextLoaderOptions
): Promise<UniverseContext> {
  const basePath = options.universeDir;
  
  // Load universe config
  const config = await readJsonFile<UniverseConfig>(`${basePath}/config/universe.json`);
  
  // Load characters
  const characters = await loadCharacters(`${basePath}/characters`);
  
  // Load worlds
  const worlds = await loadWorlds(`${basePath}/worlds`);
  
  // Load story
  const story = await readJsonFile<StoryProfile>(`${basePath}/story/story.json`);
  
  // Load episodes
  const episodes = await loadEpisodes(`${basePath}/episodes`);
  
  // Load scenes
  const scenes = await loadScenes(`${basePath}/scenes`);
  
  return {
    config,
    characters,
    worlds,
    story,
    episodes,
    scenes,
  };
}

/**
 * Create generation context from universe context
 */
export function createGenerationContext(
  universeContext: UniverseContext,
  episodeId?: string,
  sceneId?: string
): GenerationContext {
  const episode = episodeId 
    ? universeContext.episodes[episodeId] 
    : Object.values(universeContext.episodes)[0];
  
  const scenes = episodeId 
    ? Object.values(universeContext.scenes).filter(s => s.episodeId === episodeId)
    : Object.values(universeContext.scenes);
  
  return {
    universeConfig: universeContext.config,
    characterBibles: universeContext.characters,
    worldBibles: universeContext.worlds,
    storyProfile: universeContext.story,
    episodeStructure: episode || Object.values(universeContext.episodes)[0]!,
    previousScenes: scenes.sort((a, b) => a.number - b.number),
    characterStates: {},
    worldState: {},
  };
}

/**
 * Load character profiles from directory
 */
async function loadCharacters(dir: string): Promise<Record<string, CharacterProfile>> {
  const characters: Record<string, CharacterProfile> = {};
  
  try {
    const files = listFiles(dir, ['.json', '.yaml', '.yml']);
    
    for (const file of files) {
      const char = file.endsWith('.json') 
        ? await readJsonFile<CharacterProfile>(file)
        : await readYamlFile<CharacterProfile>(file);
      
      if (char && char.id) {
        characters[char.id] = char;
      }
    }
  } catch {
    // Directory might not exist
  }
  
  return characters;
}

/**
 * Load world profiles from directory
 */
async function loadWorlds(dir: string): Promise<Record<string, WorldProfile>> {
  const worlds: Record<string, WorldProfile> = {};
  
  try {
    const files = listFiles(dir, ['.json', '.yaml', '.yml']);
    
    for (const file of files) {
      const world = file.endsWith('.json')
        ? await readJsonFile<WorldProfile>(file)
        : await readYamlFile<WorldProfile>(file);
      
      if (world && world.id) {
        worlds[world.id] = world;
      }
    }
  } catch {
    // Directory might not exist
  }
  
  return worlds;
}

/**
 * Load episodes from directory
 */
async function loadEpisodes(dir: string): Promise<Record<string, EpisodeStructure>> {
  const episodes: Record<string, EpisodeStructure> = {};
  
  try {
    const files = listFiles(dir, ['.json', '.yaml', '.yml']);
    
    for (const file of files) {
      const episode = file.endsWith('.json')
        ? await readJsonFile<EpisodeStructure>(file)
        : await readYamlFile<EpisodeStructure>(file);
      
      if (episode && episode.id) {
        episodes[episode.id] = episode;
      }
    }
  } catch {
    // Directory might not exist
  }
  
  return episodes;
}

/**
 * Load scenes from directory
 */
async function loadScenes(dir: string): Promise<Record<string, SceneData>> {
  const scenes: Record<string, SceneData> = {};
  
  try {
    const files = listFiles(dir, ['.json', '.yaml', '.yml']);
    
    for (const file of files) {
      const scene = file.endsWith('.json')
        ? await readJsonFile<SceneData>(file)
        : await readYamlFile<SceneData>(file);
      
      if (scene && scene.id) {
        scenes[scene.id] = scene;
      }
    }
  } catch {
    // Directory might not exist
  }
  
  return scenes;
}

/**
 * Save universe context to directory
 */
export async function saveUniverseContext(
  context: UniverseContext,
  basePath: string
): Promise<void> {
  // Save config
  await ensureDir(`${basePath}/config`);
  await writeJsonFile(`${basePath}/config/universe.json`, context.config);
  
  // Save characters
  await ensureDir(`${basePath}/characters`);
  for (const [id, char] of Object.entries(context.characters)) {
    await writeJsonFile(`${basePath}/characters/${id}.json`, char);
  }
  
  // Save worlds
  await ensureDir(`${basePath}/worlds`);
  for (const [id, world] of Object.entries(context.worlds)) {
    await writeJsonFile(`${basePath}/worlds/${id}.json`, world);
  }
  
  // Save story
  await ensureDir(`${basePath}/story`);
  await writeJsonFile(`${basePath}/story/story.json`, context.story);
  
  // Save episodes
  await ensureDir(`${basePath}/episodes`);
  for (const [id, episode] of Object.entries(context.episodes)) {
    await writeJsonFile(`${basePath}/episodes/${id}.json`, episode);
  }
  
  // Save scenes
  await ensureDir(`${basePath}/scenes`);
  for (const [id, scene] of Object.entries(context.scenes)) {
    await writeJsonFile(`${basePath}/scenes/${id}.json`, scene);
  }
}

/**
 * Write JSON file
 */
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const { writeJsonFile: write } = await import('@suro-buya/shared');
  write(filePath, data);
}