/**
 * Suro-Buya Engine v2 - Generation Module
 * 
 * Scene and episode generation logic.
 */

import type { 
  SceneGenerationInput, 
  EpisodeGenerationInput, 
  GenerationContext,
  SceneData,
  EpisodeStructure,
  EngineConfig 
} from './types.js';

/**
 * Generation options
 */
export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  seed?: number;
}

/**
 * Generated scene output
 */
export interface GeneratedScene {
  scene: SceneData;
  content: string;
  metadata: {
    model: string;
    tokensUsed: number;
    duration: number;
    timestamp: string;
  };
}

/**
 * Generated episode output
 */
export interface GeneratedEpisode {
  episode: EpisodeStructure;
  scenes: GeneratedScene[];
  metadata: {
    model: string;
    totalTokens: number;
    duration: number;
    timestamp: string;
  };
}

/**
 * Generate a scene using LLM
 */
export async function generateScene(
  input: SceneGenerationInput,
  context: GenerationContext,
  config: EngineConfig,
  options: GenerationOptions = {}
): Promise<GeneratedScene> {
  const startTime = Date.now();
  
  // Build prompt from context and input
  const prompt = buildScenePrompt(input, context);
  
  // In a real implementation, this would call an LLM API
  // For now, return a structured template
  const content = generateSceneTemplate(input, context);
  
  const scene: SceneData = {
    id: `scene-${input.episodeId}-${input.sceneNumber}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    number: input.sceneNumber,
    episodeId: input.episodeId,
    location: input.location,
    timeOfDay: input.timeOfDay,
    characters: input.characters,
    type: input.type,
    beats: input.keyBeats.map((beat, index) => ({
      order: index + 1,
      description: beat,
    })),
    estimatedDuration: input.estimatedDuration,
    visualNotes: input.specialInstructions,
    audioNotes: undefined,
  };
  
  return {
    scene,
    content,
    metadata: {
      model: options.model || config.defaultModel,
      tokensUsed: estimateTokens(content),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Generate an episode structure
 */
export async function generateEpisode(
  input: EpisodeGenerationInput,
  context: GenerationContext,
  config: EngineConfig,
  options: GenerationOptions = {}
): Promise<GeneratedEpisode> {
  const startTime = Date.now();
  
  const prompt = buildEpisodePrompt(input, context);
  
  // Generate episode structure
  const episode: EpisodeStructure = {
    id: `episode-s${input.seasonNumber.toString().padStart(2, '0')}e${input.episodeNumber.toString().padStart(2, '0')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    number: input.episodeNumber,
    season: input.seasonNumber,
    title: input.title,
    summary: input.keyPlotPoints.join(' → '),
    scenes: input.keyPlotPoints.map((point, index) => ({
      number: index + 1,
      location: input.focusCharacters[0] || 'unknown',
      characters: input.focusCharacters,
      summary: point,
      type: determineSceneType(index, input.keyPlotPoints.length) as EpisodeStructure['scenes'][0]['type'],
      estimatedDuration: Math.round(input.targetRuntime / input.sceneCount),
    })),
    themes: input.themes,
    characterArcs: input.focusCharacters.map(c => `${c}: development`),
  };
  
  // Generate individual scenes
  const generatedScenes: GeneratedScene[] = [];
  let totalTokens = 0;
  
  for (const sceneSummary of episode.scenes) {
    const sceneInput: SceneGenerationInput = {
      universeId: input.universeId,
      episodeId: episode.id,
      sceneNumber: sceneSummary.number,
      location: sceneSummary.location,
      timeOfDay: 'day',
      characters: sceneSummary.characters,
      type: sceneSummary.type,
      estimatedDuration: sceneSummary.estimatedDuration,
      keyBeats: [sceneSummary.summary],
    };
    
    const generated = await generateScene(sceneInput, context, config, options);
    generatedScenes.push(generated);
    totalTokens += generated.metadata.tokensUsed;
  }
  
  return {
    episode,
    scenes: generatedScenes,
    metadata: {
      model: options.model || config.defaultModel,
      totalTokens,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build scene generation prompt
 */
function buildScenePrompt(input: SceneGenerationInput, context: GenerationContext): string {
  const chars = input.characters
    .map(id => context.characterBibles[id])
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  const charDescriptions = chars.map(c => 
    `- ${c.name} (${c.archetype}): ${c.description}. Voice: ${c.voice?.tone || 'neutral'}`
  ).join('\n');
  
  const locationKey = Object.keys(context.worldBibles).find(k => 
    k.toLowerCase().includes(input.location.toLowerCase())
  );
  const location = context.worldBibles[input.location] || 
    (locationKey ? context.worldBibles[locationKey] : undefined) || 
    { name: input.location, description: 'Unknown location' };
  
  return `SCENE GENERATION REQUEST

UNIVERSE: ${context.universeConfig.name} (${context.universeConfig.id})
STORY: ${context.storyProfile.title} - ${context.storyProfile.logline}
EPISODE: ${context.episodeStructure?.title || 'Unknown'} (S${context.episodeStructure?.season}E${context.episodeStructure?.number})
SCENE: #${input.sceneNumber}

LOCATION: ${location.name}
TIME: ${input.timeOfDay}
TYPE: ${input.type}
DURATION: ~${input.estimatedDuration} minutes

CHARACTERS PRESENT:
${charDescriptions}

PREVIOUS SCENE: ${input.previousSceneSummary || 'N/A'}

KEY BEATS:
${input.keyBeats.map((b, i) => `${i + 1}. ${b}`).join('\n')}

SPECIAL INSTRUCTIONS: ${input.specialInstructions || 'None'}

FORMAT: Screenplay format with scene heading, action, and dialogue.
TONE: ${context.storyProfile.tone}`;
}

/**
 * Build episode generation prompt
 */
function buildEpisodePrompt(input: EpisodeGenerationInput, context: GenerationContext): string {
  return `EPISODE GENERATION REQUEST

UNIVERSE: ${context.universeConfig.name} (${context.universeConfig.id})
STORY: ${context.storyProfile.title} - ${context.storyProfile.logline}

EPISODE: S${input.seasonNumber}E${input.episodeNumber} - "${input.title}"
ARC: ${input.storyArc || 'Main'}
RUNTIME: ~${input.targetRuntime} minutes
SCENES: ${input.sceneCount}

FOCUS CHARACTERS: ${input.focusCharacters.join(', ')}
THEMES: ${input.themes.join(', ')}

KEY PLOT POINTS:
${input.keyPlotPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

GENERATE: Episode structure with ${input.sceneCount} scenes, each with location, characters, summary, and type.`;
}

/**
 * Generate scene template content
 */
function generateSceneTemplate(input: SceneGenerationInput, context: GenerationContext): string {
  const location = context.worldBibles[input.location]?.name || input.location;
  
  let content = `SCENE ${input.sceneNumber}: ${location.toUpperCase()} - ${input.timeOfDay.toUpperCase()}\n\n`;
  
  // Add scene description
  content += `[${input.type.toUpperCase()} SCENE]\n\n`;
  
  // Add beats as action/dialogue
  for (const beat of input.keyBeats) {
    content += `${beat}\n\n`;
  }
  
  // Add character dialogue placeholders
  if (input.characters.length > 0 && input.type !== 'action') {
    content += `DIALOGUE:\n`;
    for (const charId of input.characters) {
      const char = context.characterBibles[charId];
      if (char) {
        content += `${char.name.toUpperCase()}: [Dialogue here]\n`;
      }
    }
  }
  
  return content;
}

/**
 * Determine scene type based on position in episode
 */
function determineSceneType(index: number, total: number): SceneData['type'] {
  if (index === 0) return 'exposition';
  if (index === total - 1) return 'resolution';
  if (index === Math.floor(total / 2)) return 'climax';
  if (index < total / 3) return 'exposition';
  if (index < 2 * total / 3) return 'action';
  return 'dialogue';
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}