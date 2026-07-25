/**
 * Suro-Buya Engine v2 - Episode Planner
 * 
 * Plans episode structure: beats, scenes, character arcs, act breaks.
 */

import { z } from 'zod';
import type { 
  EpisodeStructure,
  GenerationContext,
  UniverseConfig,
  CharacterProfile,
  WorldProfile,
  StoryProfile,
} from '../types.js';
import { GenerationOrchestrator, EpisodeStructureOutputSchema, EpisodeStructureOutput } from '../generate/orchestrator.js';
import { ProviderRegistry } from '../ai/registry.js';

/**
 * Episode planner input (extends EpisodeGenerationInput with additional fields)
 */
export interface EpisodePlannerInput {
  /** Universe ID */
  universeId: string;
  /** Season number */
  seasonNumber: number;
  /** Episode number */
  episodeNumber: number;
  /** Episode title */
  title: string;
  /** Episode premise/logline */
  premise: string;
  /** Story arc identifier */
  storyArc?: string;
  /** Focus characters */
  focusCharacters: string[];
  /** Key plot points */
  keyPlotPoints: string[];
  /** Episode themes */
  themes: string[];
  /** Target runtime (minutes) */
  targetRuntime: number;
  /** Number of scenes */
  sceneCount: number;
  /** Previous episode summary for continuity */
  previousEpisodeSummary?: string;
}

/**
 * Scene plan (lightweight version of SceneData for planning)
 */
export interface ScenePlan {
  number: number;
  location: string;
  timeOfDay: string;
  characters: string[];
  type: 'dialogue' | 'action' | 'exposition' | 'climax' | 'resolution' | 'transition';
  summary: string;
  estimatedDuration: number;
  beats: string[]; // beat IDs
}

/**
 * Character arc for episode
 */
export interface CharacterArc {
  characterId: string;
  episodeId: string;
  arcType: 'growth' | 'test' | 'reveal' | 'static' | 'regression';
  startState: string;
  endState: string;
  beats: string[]; // beat IDs
  description: string;
}

/**
 * Beat types for episode planning
 */
export type BeatType = 
  | 'hook'           // Opening hook
  | 'inciting'       // Inciting incident
  | 'rising'         // Rising action
  | 'complication'   // Complication/twist
  | 'climax'         // Climax
  | 'resolution'     // Resolution
  | 'cliffhanger'    // Ending hook for next episode
  | 'character'      // Character development beat
  | 'worldbuilding'  // World building beat
  | 'relationship';  // Relationship development beat

/**
 * Episode beat structure
 */
export interface EpisodeBeat {
  id: string;
  type: BeatType;
  order: number;
  description: string;
  characters: string[];
  location?: string;
  estimatedDuration: number; // minutes
  act: 1 | 2 | 3;
  dependencies: string[]; // beat IDs this depends on
  emotionalArc: 'rising' | 'falling' | 'peak' | 'valley' | 'steady';
  stakes: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Act structure
 */
export interface ActStructure {
  number: 1 | 2 | 3;
  beats: EpisodeBeat[];
  estimatedDuration: number; // minutes
  theme: string;
  turningPoint: string; // The beat that turns the act
}

/**
 * Episode plan (more detailed than EpisodeStructure)
 */
export interface EpisodePlan {
  id: string;
  season: number;
  number: number;
  title: string;
  logline: string;
  summary: string;
  beats: EpisodeBeat[];
  acts: ActStructure[];
  scenes: ScenePlan[];
  characterArcs: CharacterArc[];
  themes: string[];
  runtimeMinutes: number;
  actBreaks: number[]; // beat indices where acts break
  bStory?: {
    character: string;
    beats: EpisodeBeat[];
  };
  metadata: {
    createdAt: string;
    version: number;
    source: 'generated' | 'manual' | 'hybrid';
  };
}

/**
 * Episode planner options
 */
export interface EpisodePlannerOptions {
  targetRuntimeMinutes?: number;
  acts?: number;
  scenesPerAct?: number;
  beatsPerAct?: number;
  includeBStory?: boolean;
  tone?: string;
  focusCharacters?: string[];
  requiredBeats?: BeatType[];
  forbiddenBeats?: BeatType[];
}

/**
 * Episode Planner - generates structured episode plans
 */
export class EpisodePlanner {
  private orchestrator: GenerationOrchestrator;
  private registry: ProviderRegistry;
  private defaultOptions: Required<EpisodePlannerOptions>;

  constructor(
    orchestrator: GenerationOrchestrator,
    registry: ProviderRegistry,
    options: EpisodePlannerOptions = {}
  ) {
    this.orchestrator = orchestrator;
    this.registry = registry;
    this.defaultOptions = {
      targetRuntimeMinutes: options.targetRuntimeMinutes ?? 22,
      acts: options.acts ?? 3,
      scenesPerAct: options.scenesPerAct ?? 3,
      beatsPerAct: options.beatsPerAct ?? 4,
      includeBStory: options.includeBStory ?? true,
      tone: options.tone ?? 'dramedy',
      focusCharacters: options.focusCharacters ?? [],
      requiredBeats: options.requiredBeats ?? ['hook', 'inciting', 'climax', 'resolution'],
      forbiddenBeats: options.forbiddenBeats ?? [],
    };
  }

  /**
   * Generate a complete episode plan
   */
  async generateEpisodePlan(
    input: EpisodePlannerInput,
    context: GenerationContext,
    options: EpisodePlannerOptions = {}
  ): Promise<EpisodePlan> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Step 1: Generate high-level episode structure using LLM
    const structureResult = await this.orchestrator.generateEpisodeStructure(input, context, {
      temperature: 0.8,
      maxTokens: 4000,
    });

    if (!structureResult.success || !structureResult.data) {
      throw new Error(`Episode structure generation failed: ${structureResult.error}`);
    }

    const structure = structureResult.data.episode;

    // Step 2: Expand into detailed beats
    const beats = await this.generateBeats(
      input,
      structure,
      context,
      mergedOptions
    );

    // Step 3: Organize beats into acts
    const acts = this.organizeIntoActs(beats, mergedOptions.acts);

    // Step 4: Plan scenes from beats
    const scenes = this.planScenesFromBeats(beats, acts, structure, mergedOptions);

    // Step 5: Generate character arcs for this episode
    const characterArcs = await this.generateCharacterArcs(
      input,
      beats,
      context,
      mergedOptions
    );

    // Step 6: Add B-story if enabled
    let bStory: EpisodePlan['bStory'];
    if (mergedOptions.includeBStory) {
      bStory = await this.generateBStory(input, beats, context, mergedOptions);
    }

    // Step 7: Calculate act breaks
    const actBreaks = acts.map((act, i) => 
      i < acts.length - 1 ? beats.findIndex(b => b.act === act.number + 1) ?? beats.length : beats.length
    ).filter(b => b > 0);

    const plan: EpisodePlan = {
      id: structure.id,
      season: structure.season,
      number: structure.number,
      title: structure.title,
      logline: this.generateLogline(structure, beats),
      summary: structure.summary,
      beats,
      acts,
      scenes,
      characterArcs,
      themes: structure.themes,
      runtimeMinutes: structure.scenes.reduce((sum, s) => sum + s.estimatedDuration, 0),
      actBreaks,
      bStory,
      metadata: {
        createdAt: new Date().toISOString(),
        version: 1,
        source: 'generated',
      },
    };

    return plan;
  }

  /**
   * Generate detailed beats from episode structure
   */
  private async generateBeats(
    input: EpisodePlannerInput,
    structure: EpisodeStructure,
    context: GenerationContext,
    options: Required<EpisodePlannerOptions>
  ): Promise<EpisodeBeat[]> {
    const beats: EpisodeBeat[] = [];
    const beatOrder = 0;

    // Required beats in order
    const requiredBeats = options.requiredBeats.filter(b => !options.forbiddenBeats.includes(b));
    
    // Generate beats for each scene in structure
    for (let i = 0; i < structure.scenes.length; i++) {
      const scene = structure.scenes[i];
      if (!scene) continue;
      const actNumber = this.determineAct(i, structure.scenes.length, options.acts);
      
      // Create beats for this scene
      const sceneBeats = await this.generateSceneBeats(
        scene,
        actNumber,
        i,
        structure,
        context,
        options
      );
      
      beats.push(...sceneBeats);
    }

    // Ensure required beats exist
    this.ensureRequiredBeats(beats, requiredBeats, structure, context);

    // Sort and renumber
    beats.sort((a, b) => a.order - b.order);
    beats.forEach((beat, index) => {
      beat.order = index + 1;
      beat.id = `beat-${beat.order}`;
    });

    return beats;
  }

  /**
   * Generate beats for a single scene
   */
  private async generateSceneBeats(
    scene: EpisodeStructure['scenes'][0],
    actNumber: 1 | 2 | 3,
    sceneIndex: number,
    structure: EpisodeStructure,
    context: GenerationContext,
    options: Required<EpisodePlannerOptions>
  ): Promise<EpisodeBeat[]> {
    const beats: EpisodeBeat[] = [];
    const baseOrder = sceneIndex * options.beatsPerAct;

    // Map scene type to beat types
    const beatTypesForScene = this.getBeatTypesForScene(scene.type, actNumber);
    
    for (const [i, beatType] of beatTypesForScene.entries()) {
      const order = baseOrder + i + 1;
      
      const beat: EpisodeBeat = {
        id: `beat-${order}`,
        type: beatType,
        order,
        description: this.generateBeatDescription(beatType, scene, structure),
        characters: scene.characters,
        location: scene.location,
        estimatedDuration: Math.ceil(scene.estimatedDuration / beatTypesForScene.length),
        act: actNumber,
        dependencies: i > 0 ? [`beat-${order - 1}`] : [],
        emotionalArc: this.getEmotionalArc(beatType, actNumber),
        stakes: this.getStakes(beatType, actNumber),
      };
      
      beats.push(beat);
    }

    return beats;
  }

  /**
   * Map scene type to appropriate beat types
   */
  private getBeatTypesForScene(
    sceneType: EpisodeStructure['scenes'][0]['type'],
    act: 1 | 2 | 3
  ): BeatType[] {
    const baseTypes: Record<string, BeatType[]> = {
      exposition: ['hook', 'worldbuilding', 'character'],
      dialogue: ['character', 'relationship'],
      action: ['rising', 'complication'],
      climax: ['climax'],
      resolution: ['resolution', 'cliffhanger'],
      transition: ['character', 'worldbuilding'],
    };

    const types = baseTypes[sceneType] ?? ['character'];

    // Adjust for act
    if (act === 1) {
      // Act 1: Setup beats
      return types.map(t => t === 'climax' ? 'rising' : t === 'resolution' ? 'character' : t);
    } else if (act === 2) {
      // Act 2: Confrontation beats
      return types.map(t => t === 'hook' ? 'complication' : t === 'resolution' ? 'rising' : t);
    } else {
      // Act 3: Resolution beats
      return types.map(t => t === 'hook' ? 'climax' : t === 'rising' ? 'climax' : t);
    }
  }

  /**
   * Generate beat description
   */
  private generateBeatDescription(
    beatType: BeatType,
    scene: EpisodeStructure['scenes'][0],
    structure: EpisodeStructure
  ): string {
    const templates: Record<BeatType, string> = {
      hook: `Opening hook: ${scene.summary} - grab attention with ${structure.themes[0] || 'intrigue'}`,
      inciting: `Inciting incident disrupts ${scene.characters[0] || 'protagonist'}'s status quo`,
      rising: `Rising action: ${scene.summary} escalates the conflict`,
      complication: `Complication: Unexpected twist in ${scene.location} challenges ${scene.characters.join(', ')}`,
      climax: `Climax: Ultimate confrontation in ${scene.location} - ${scene.summary}`,
      resolution: `Resolution: Aftermath of climax, ${scene.characters[0] || 'characters'} process events`,
      cliffhanger: `Cliffhanger: Final moment in ${scene.location} teases next episode`,
      character: `Character moment: ${scene.characters[0] || 'Protagonist'} reveals depth through ${scene.summary}`,
      worldbuilding: `Worldbuilding: Establish ${scene.location}'s rules and atmosphere`,
      relationship: `Relationship beat: ${scene.characters.slice(0, 2).join(' vs ')} dynamic shifts`,
    };

    return templates[beatType] || `${beatType}: ${scene.summary}`;
  }

  /**
   * Determine act number for scene index
   */
  private determineAct(sceneIndex: number, totalScenes: number, numActs: number): 1 | 2 | 3 {
    const actSize = totalScenes / numActs;
    const act = Math.floor(sceneIndex / actSize) + 1;
    return Math.min(act, 3) as 1 | 2 | 3;
  }

  /**
   * Get emotional arc for beat type and act
   */
  private getEmotionalArc(beatType: BeatType, act: 1 | 2 | 3): EpisodeBeat['emotionalArc'] {
    const arcs: Record<BeatType, EpisodeBeat['emotionalArc']> = {
      hook: 'rising',
      inciting: 'peak',
      rising: 'rising',
      complication: 'valley',
      climax: 'peak',
      resolution: 'falling',
      cliffhanger: 'rising',
      character: 'steady',
      worldbuilding: 'steady',
      relationship: 'rising',
    };
    return arcs[beatType] || 'steady';
  }

  /**
   * Get stakes level for beat type and act
   */
  private getStakes(beatType: BeatType, act: 1 | 2 | 3): EpisodeBeat['stakes'] {
    const stakes: Record<BeatType, EpisodeBeat['stakes']> = {
      hook: 'low',
      inciting: 'medium',
      rising: 'medium',
      complication: 'high',
      climax: 'critical',
      resolution: 'low',
      cliffhanger: 'high',
      character: 'low',
      worldbuilding: 'low',
      relationship: 'medium',
    };
    return stakes[beatType] || 'low';
  }

  /**
   * Ensure required beats exist
   */
  private ensureRequiredBeats(
    beats: EpisodeBeat[],
    requiredBeats: BeatType[],
    structure: EpisodeStructure,
    context: GenerationContext
  ): void {
    const firstScene = structure.scenes[0];
    if (!firstScene) return;

    for (const requiredType of requiredBeats) {
      if (!beats.some(b => b.type === requiredType)) {
        // Add missing required beat
        const actMap: Record<BeatType, 1 | 2 | 3> = {
          hook: 1,
          inciting: 1,
          climax: 3,
          resolution: 3,
          cliffhanger: 3,
          rising: 2,
          complication: 2,
          character: 2,
          worldbuilding: 1,
          relationship: 2,
        };
        
        const newBeat: EpisodeBeat = {
          id: `beat-${requiredType}-${Date.now()}`,
          type: requiredType,
          order: beats.length + 1,
          description: this.generateBeatDescription(requiredType, firstScene, structure),
          characters: firstScene.characters || [],
          location: firstScene.location,
          estimatedDuration: 3,
          act: actMap[requiredType] || 2,
          dependencies: [],
          emotionalArc: this.getEmotionalArc(requiredType, actMap[requiredType] || 2),
          stakes: this.getStakes(requiredType, actMap[requiredType] || 2),
        };
        beats.push(newBeat);
      }
    }
  }

  /**
   * Organize beats into act structure
   */
  private organizeIntoActs(
    beats: EpisodeBeat[],
    numActs: number
  ): ActStructure[] {
    const acts: ActStructure[] = [];
    const beatsPerAct = Math.ceil(beats.length / numActs);

    for (let i = 0; i < numActs; i++) {
      const actBeats = beats.filter(b => b.act === i + 1);
      const actNumber = (i + 1) as 1 | 2 | 3;
      
      acts.push({
        number: actNumber,
        beats: actBeats,
        estimatedDuration: actBeats.reduce((sum, b) => sum + b.estimatedDuration, 0),
        theme: this.getActTheme(actNumber),
        turningPoint: actBeats.find(b => b.type === 'complication' || b.type === 'climax')?.id || '',
      });
    }

    return acts;
  }

  /**
   * Get theme for act
   */
  private getActTheme(act: 1 | 2 | 3): string {
    const themes = {
      1: 'Setup & Inciting Incident',
      2: 'Confrontation & Complications',
      3: 'Climax & Resolution',
    };
    return themes[act];
  }

  /**
   * Plan scenes from beats
   */
  private planScenesFromBeats(
    beats: EpisodeBeat[],
    acts: ActStructure[],
    structure: EpisodeStructure,
    options: Required<EpisodePlannerOptions>
  ): ScenePlan[] {
    const scenes: ScenePlan[] = [];
    let sceneNumber = 1;

    for (const act of acts) {
      // Group beats by location to form scenes
      const beatsByLocation = new Map<string, EpisodeBeat[]>();
      
      for (const beat of act.beats) {
        const location = beat.location || 'UNKNOWN';
        if (!beatsByLocation.has(location)) {
          beatsByLocation.set(location, []);
        }
        beatsByLocation.get(location)!.push(beat);
      }

      for (const [location, locationBeats] of beatsByLocation) {
        const characters = [...new Set(locationBeats.flatMap(b => b.characters))];
        const beatIds = locationBeats.map(b => b.id);
        
        scenes.push({
          number: sceneNumber++,
          location,
          timeOfDay: this.inferTimeOfDay(locationBeats),
          characters,
          type: this.inferSceneType(locationBeats),
          summary: locationBeats.map(b => b.description).join('; '),
          estimatedDuration: locationBeats.reduce((sum, b) => sum + b.estimatedDuration, 0),
          beats: beatIds,
        });
      }
    }

    return scenes;
  }

  /**
   * Infer time of day from beats
   */
  private inferTimeOfDay(beats: EpisodeBeat[]): string {
    // Default to day, could be enhanced with actual logic
    return 'day';
  }

  /**
   * Infer scene type from beats
   */
  private inferSceneType(beats: EpisodeBeat[]): ScenePlan['type'] {
    const types = beats.map(b => b.type);
    if (types.includes('climax')) return 'climax';
    if (types.includes('complication')) return 'action';
    if (types.includes('hook') || types.includes('inciting')) return 'exposition';
    if (types.includes('resolution')) return 'resolution';
    if (types.some(t => ['character', 'relationship'].includes(t))) return 'dialogue';
    return 'exposition';
  }

  /**
   * Generate character arcs for episode
   */
  private async generateCharacterArcs(
    input: EpisodePlannerInput,
    beats: EpisodeBeat[],
    context: GenerationContext,
    options: Required<EpisodePlannerOptions>
  ): Promise<CharacterArc[]> {
    const focusChars = options.focusCharacters.length > 0 
      ? options.focusCharacters 
      : [...new Set(beats.flatMap(b => b.characters))].slice(0, 3);

    const arcs: CharacterArc[] = [];

    for (const charName of focusChars) {
      const charBeats = beats.filter(b => b.characters.includes(charName));
      if (charBeats.length === 0) continue;

      const arc: CharacterArc = {
        characterId: charName,
        episodeId: `${input.universeId}-S${input.seasonNumber}E${input.episodeNumber}`,
        arcType: this.determineArcType(charBeats),
        startState: this.inferStartState(charName, context),
        endState: this.inferEndState(charName, charBeats),
        beats: charBeats.map(b => b.id),
        description: this.generateArcDescription(charName, charBeats),
      };
      arcs.push(arc);
    }

    return arcs;
  }

  /**
   * Determine arc type from beats
   */
  private determineArcType(beats: EpisodeBeat[]): CharacterArc['arcType'] {
    const types = beats.map(b => b.type);
    if (types.includes('climax') && types.includes('resolution')) return 'growth';
    if (types.includes('complication')) return 'test';
    if (types.some(t => ['character', 'relationship'].includes(t))) return 'reveal';
    return 'static';
  }

  /**
   * Infer character start state
   */
  private inferStartState(charName: string, context: GenerationContext): string {
    const char = context.characterBibles?.[charName];
    return char ? `${char.archetype} - ${char.description.substring(0, 100)}` : 'Unknown';
  }

  /**
   * Infer character end state
   */
  private inferEndState(charName: string, beats: EpisodeBeat[]): string {
    if (beats.length === 0) return 'No beats for this character';
    const lastBeat = beats[beats.length - 1]!;
    return `After ${lastBeat.type}: ${lastBeat.description.substring(0, 100)}`;
  }

  /**
   * Generate arc description
   */
  private generateArcDescription(charName: string, beats: EpisodeBeat[]): string {
    return `${charName} experiences ${beats.length} key moments: ${beats.map(b => b.type).join(', ')}`;
  }

  /**
   * Generate B-story
   */
  private async generateBStory(
    input: EpisodePlannerInput,
    mainBeats: EpisodeBeat[],
    context: GenerationContext,
    options: Required<EpisodePlannerOptions>
  ): Promise<EpisodePlan['bStory']> {
    // Find secondary character not in focus
    const mainChars = [...new Set(mainBeats.flatMap(b => b.characters))];
    const allChars = Object.keys(context.characterBibles || {});
    const secondaryChars = allChars.filter(c => !mainChars.includes(c));
    
    if (secondaryChars.length === 0) return undefined;

    const bStoryChar = secondaryChars[0]!;
    const bBeats: EpisodeBeat[] = [];

    // Create 2-3 beats for B-story
    const bStoryBeatTypes: BeatType[] = ['character', 'relationship', 'resolution'];
    const bStoryLocation = mainBeats[0]?.location ?? 'UNKNOWN';
    
    for (let i = 0; i < bStoryBeatTypes.length; i++) {
      const beatType = bStoryBeatTypes[i]!;
      bBeats.push({
        id: `b-beat-${i + 1}`,
        type: beatType,
        order: mainBeats.length + i + 1,
        description: `B-story: ${bStoryChar} ${beatType} beat`,
        characters: [bStoryChar],
        location: bStoryLocation,
        estimatedDuration: 2,
        act: (i + 2) as 1 | 2 | 3,
        dependencies: i > 0 ? [`b-beat-${i}`] : [],
        emotionalArc: 'steady',
        stakes: 'low',
      });
    }

    return {
      character: bStoryChar,
      beats: bBeats,
    };
  }

  /**
   * Generate logline from structure and beats
   */
  private generateLogline(structure: EpisodeStructure, beats: EpisodeBeat[]): string {
    const hookBeat = beats.find(b => b.type === 'hook');
    const climaxBeat = beats.find(b => b.type === 'climax');
    const protagonist = beats[0]?.characters[0] || 'Someone';
    
    return `${protagonist} ${hookBeat?.description.substring(0, 50) || 'faces a challenge'}, leading to ${climaxBeat?.description.substring(0, 50) || 'a climactic confrontation'}.`;
  }
}

/**
 * Create default episode planner
 */
export function createDefaultEpisodePlanner(
  orchestrator: GenerationOrchestrator,
  registry: ProviderRegistry,
  options?: EpisodePlannerOptions
): EpisodePlanner {
  return new EpisodePlanner(orchestrator, registry, options);
}

/**
 * Quick episode plan from minimal input
 */
export async function quickPlanEpisode(
  orchestrator: GenerationOrchestrator,
  registry: ProviderRegistry,
  universeId: string,
  seasonNumber: number,
  episodeNumber: number,
  title: string,
  premise: string,
  context: GenerationContext
): Promise<EpisodePlan> {
  const planner = createDefaultEpisodePlanner(orchestrator, registry);
  
  const input: EpisodePlannerInput = {
    universeId,
    seasonNumber,
    episodeNumber,
    title,
    premise,
    storyArc: '',
    focusCharacters: [],
    keyPlotPoints: [],
    themes: [],
    targetRuntime: 22,
    sceneCount: 5,
    previousEpisodeSummary: context.episodeStructure?.summary,
  };

  return planner.generateEpisodePlan(input, context);
}
