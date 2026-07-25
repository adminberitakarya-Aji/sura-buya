/**
 * Suro-Buya Engine v2 - Season Planner
 * 
 * Plans season arcs: episode progression, character arcs, themes, act structure.
 */

import { z } from 'zod';
import type { 
  GenerationContext,
  UniverseConfig,
  CharacterProfile,
  WorldProfile,
  StoryProfile,
  EpisodeStructure,
} from '../types.js';
import { EpisodePlanner, EpisodePlan, EpisodePlannerInput } from './episode-planner.js';
import { GenerationOrchestrator } from '../generate/orchestrator.js';
import { ProviderRegistry } from '../ai/registry.js';

/**
 * Season arc types
 */
export type SeasonArcType = 
  | 'serialized'      // Continuous story across episodes
  | 'episodic'        // Standalone episodes with loose connections
  | 'anthology'       // Each episode different story/characters
  | 'hybrid';         // Mix of serialized and episodic

/**
 * Character season arc
 */
export interface CharacterSeasonArc {
  characterId: string;
  arcType: 'growth' | 'decline' | 'redemption' | 'corruption' | 'discovery' | 'static';
  startState: string;
  endState: string;
  milestones: Array<{
    episodeNumber: number;
    description: string;
    beatType: string;
  }>;
  keyEpisodes: number[]; // Episodes where major changes happen
  description: string;
}

/**
 * Season theme progression
 */
export interface SeasonTheme {
  theme: string;
  description: string;
  episodes: number[]; // Which episodes explore this theme
  weight: number; // 0-1, how central to season
  evolution: 'introduce' | 'develop' | 'climax' | 'resolve';
}

/**
 * Season structure overview
 */
export interface SeasonStructure {
  id: string;
  universeId: string;
  seasonNumber: number;
  title: string;
  logline: string;
  arcType: SeasonArcType;
  episodeCount: number;
  targetRuntimeMinutes: number;
  themes: SeasonTheme[];
  characterArcs: CharacterSeasonArc[];
  episodes: EpisodeSummary[];
  actStructure: SeasonAct[];
  metadata: {
    createdAt: string;
    version: number;
    source: 'generated' | 'manual' | 'hybrid';
  };
}

/**
 * Episode summary (lightweight)
 */
export interface EpisodeSummary {
  number: number;
  title: string;
  logline: string;
  summary: string;
  themes: string[];
  focusCharacters: string[];
  estimatedRuntime: number;
  actBreaks: number[];
  keyBeats: string[];
}

/**
 * Season act structure (macro acts)
 */
export interface SeasonAct {
  number: number;
  title: string;
  description: string;
  episodeRange: [number, number]; // inclusive
  theme: string;
  turningPoint: string; // Episode number where act turns
}

/**
 * Season planner options
 */
export interface SeasonPlannerOptions {
  episodeCount?: number;
  targetRuntimeMinutes?: number;
  arcType?: SeasonArcType;
  themes?: string[];
  focusCharacters?: string[];
  requiredEpisodes?: Array<{
    number: number;
    title: string;
    premise: string;
  }>;
  tone?: string;
}

/**
 * Season Planner - generates structured season plans
 */
export class SeasonPlanner {
  private episodePlanner: EpisodePlanner;
  private orchestrator: GenerationOrchestrator;
  private registry: ProviderRegistry;
  private defaultOptions: Required<SeasonPlannerOptions>;

  constructor(
    episodePlanner: EpisodePlanner,
    orchestrator: GenerationOrchestrator,
    registry: ProviderRegistry,
    options: SeasonPlannerOptions = {}
  ) {
    this.episodePlanner = episodePlanner;
    this.orchestrator = orchestrator;
    this.registry = registry;
    this.defaultOptions = {
      episodeCount: options.episodeCount ?? 10,
      targetRuntimeMinutes: options.targetRuntimeMinutes ?? 22,
      arcType: options.arcType ?? 'serialized',
      themes: options.themes ?? [],
      focusCharacters: options.focusCharacters ?? [],
      requiredEpisodes: options.requiredEpisodes ?? [],
      tone: options.tone ?? 'dramedy',
    };
  }

  /**
   * Generate a complete season plan
   */
  async generateSeasonPlan(
    universeId: string,
    seasonNumber: number,
    context: GenerationContext,
    options: SeasonPlannerOptions = {}
  ): Promise<SeasonStructure> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Step 1: Generate season-level structure (themes, arcs, act structure)
    const seasonStructure = await this.generateSeasonStructure(
      universeId,
      seasonNumber,
      context,
      mergedOptions
    );

    // Step 2: Generate individual episode plans
    const episodes: EpisodeSummary[] = [];
    const detailedPlans: EpisodePlan[] = [];

    for (let epNum = 1; epNum <= mergedOptions.episodeCount; epNum++) {
      // Check if this is a required episode
      const requiredEp = mergedOptions.requiredEpisodes.find(e => e.number === epNum);
      
      const episodeInput: EpisodePlannerInput = {
        universeId,
        seasonNumber,
        episodeNumber: epNum,
        title: requiredEp?.title || `Episode ${epNum}`,
        premise: requiredEp?.premise || seasonStructure.episodes[epNum - 1]?.summary || 'TBD',
        storyArc: seasonStructure.id,
        focusCharacters: mergedOptions.focusCharacters,
        keyPlotPoints: this.getKeyPlotPointsForEpisode(epNum, seasonStructure),
        themes: this.getThemesForEpisode(epNum, seasonStructure),
        targetRuntime: mergedOptions.targetRuntimeMinutes,
        sceneCount: 5,
        previousEpisodeSummary: epNum > 1 ? seasonStructure.episodes[epNum - 2]?.summary : undefined,
      };

      const plan = await this.episodePlanner.generateEpisodePlan(
        episodeInput,
        context,
        {
          targetRuntimeMinutes: mergedOptions.targetRuntimeMinutes,
          includeBStory: true,
          tone: mergedOptions.tone,
        }
      );

      detailedPlans.push(plan);
      
      episodes.push({
        number: plan.number,
        title: plan.title,
        logline: plan.logline,
        summary: plan.summary,
        themes: plan.themes,
        focusCharacters: plan.beats.flatMap(b => b.characters).filter((v, i, a) => a.indexOf(v) === i),
        estimatedRuntime: plan.runtimeMinutes,
        actBreaks: plan.actBreaks,
        keyBeats: plan.beats.filter(b => ['hook', 'inciting', 'climax', 'resolution', 'cliffhanger'].includes(b.type)).map(b => b.description),
      });
    }

    // Step 3: Generate character season arcs from episode arcs
    const characterArcs = this.generateCharacterSeasonArcs(
      mergedOptions.focusCharacters,
      detailedPlans,
      context
    );

    // Step 4: Build season act structure
    const seasonActs = this.buildSeasonActs(mergedOptions.episodeCount, mergedOptions.arcType);

    const season: SeasonStructure = {
      id: seasonStructure.id,
      universeId,
      seasonNumber,
      title: seasonStructure.title,
      logline: seasonStructure.logline,
      arcType: mergedOptions.arcType,
      episodeCount: mergedOptions.episodeCount,
      targetRuntimeMinutes: mergedOptions.targetRuntimeMinutes,
      themes: seasonStructure.themes,
      characterArcs,
      episodes,
      actStructure: seasonActs,
      metadata: {
        createdAt: new Date().toISOString(),
        version: 1,
        source: 'generated',
      },
    };

    return season;
  }

  /**
   * Generate high-level season structure using LLM
   */
  private async generateSeasonStructure(
    universeId: string,
    seasonNumber: number,
    context: GenerationContext,
    options: Required<SeasonPlannerOptions>
  ): Promise<{
    id: string;
    title: string;
    logline: string;
    themes: SeasonTheme[];
    episodes: EpisodeSummary[];
  }> {
    // For now, create a structured season plan without LLM
    // In production, this would call the orchestrator with a season planning prompt
    
    const id = `${universeId}-S${seasonNumber}`;
    
    // Generate theme progression across season
    const themes: SeasonTheme[] = this.generateSeasonThemes(options.themes, options.episodeCount);
    
    // Generate episode summaries
    const episodes: EpisodeSummary[] = this.generateEpisodeSummaries(
      seasonNumber,
      options.episodeCount,
      options.arcType,
      themes,
      options.focusCharacters,
      context
    );

    return {
      id,
      title: `Season ${seasonNumber}`,
      logline: this.generateSeasonLogline(seasonNumber, options.arcType, themes),
      themes,
      episodes,
    };
  }

  /**
   * Generate season themes with progression
   */
  private generateSeasonThemes(
    baseThemes: string[],
    episodeCount: number
  ): SeasonTheme[] {
    const defaultThemes = ['identity', 'loyalty', 'power', 'sacrifice', 'redemption'];
    const themes = baseThemes.length > 0 ? baseThemes : defaultThemes;
    
    return themes.slice(0, 5).map((theme, index) => ({
      theme,
      description: `Exploration of ${theme} through character choices and consequences`,
      episodes: this.distributeThemeAcrossEpisodes(index, themes.length, episodeCount),
      weight: 1 / themes.length,
      evolution: this.getThemeEvolution(index, themes.length),
    }));
  }

  /**
   * Distribute theme across episodes
   */
  private distributeThemeAcrossEpisodes(
    themeIndex: number,
    totalThemes: number,
    episodeCount: number
  ): number[] {
    const episodesPerTheme = Math.ceil(episodeCount / totalThemes);
    const start = themeIndex * episodesPerTheme + 1;
    const end = Math.min(start + episodesPerTheme - 1, episodeCount);
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  /**
   * Get theme evolution stage
   */
  private getThemeEvolution(themeIndex: number, totalThemes: number): SeasonTheme['evolution'] {
    const progress = themeIndex / (totalThemes - 1 || 1);
    if (progress < 0.25) return 'introduce';
    if (progress < 0.5) return 'develop';
    if (progress < 0.75) return 'climax';
    return 'resolve';
  }

  /**
   * Generate episode summaries for season
   */
  private generateEpisodeSummaries(
    seasonNumber: number,
    episodeCount: number,
    arcType: SeasonArcType,
    themes: SeasonTheme[],
    focusCharacters: string[],
    context: GenerationContext
  ): EpisodeSummary[] {
    const episodes: EpisodeSummary[] = [];
    
    for (let i = 1; i <= episodeCount; i++) {
      const episodeThemes = themes
        .filter(t => t.episodes.includes(i))
        .map(t => t.theme);
      
      const isPremiere = i === 1;
      const isFinale = i === episodeCount;
      const isMidpoint = i === Math.ceil(episodeCount / 2);
      
      episodes.push({
        number: i,
        title: this.generateEpisodeTitle(i, isPremiere, isFinale, isMidpoint, arcType),
        logline: this.generateEpisodeLogline(i, episodeThemes, focusCharacters, arcType),
        summary: this.generateEpisodeSummary(i, episodeThemes, focusCharacters, arcType, isPremiere, isFinale, isMidpoint),
        themes: episodeThemes,
        focusCharacters: this.getFocusCharactersForEpisode(i, focusCharacters, episodeCount, arcType),
        estimatedRuntime: 22,
        actBreaks: [Math.floor(22/3), Math.floor(2*22/3)],
        keyBeats: this.getKeyBeatsForEpisode(i, isPremiere, isFinale, isMidpoint, arcType),
      });
    }

    return episodes;
  }

  /**
   * Generate episode title
   */
  private generateEpisodeTitle(
    number: number,
    isPremiere: boolean,
    isFinale: boolean,
    isMidpoint: boolean,
    arcType: SeasonArcType
  ): string {
    if (isPremiere) return 'Pilot';
    if (isFinale) return 'Finale';
    if (isMidpoint) return 'Midpoint';
    
    const titles = [
      'The Spark', 'Rising Tensions', 'First Blood', 'Crossroads',
      'The Calm Before', 'Into the Fire', 'Breaking Point', 'Aftermath',
      'New Beginnings', 'Resolution'
    ];
    
    return titles[number - 2] ?? `Episode ${number}`;
  }

  /**
   * Generate episode logline
   */
  private generateEpisodeLogline(
    number: number,
    themes: string[],
    focusCharacters: string[],
    arcType: SeasonArcType
  ): string {
    const primaryTheme = themes[0] || 'conflict';
    const protagonist = focusCharacters[0] || 'The protagonist';
    
    const templates = {
      serialized: [
        `${protagonist} discovers a secret that changes everything`,
        `${protagonist} faces their first major test`,
        `Alliances shift as ${protagonist} navigates ${primaryTheme}`,
        `The stakes raise when ${protagonist} confronts their past`,
      ],
      episodic: [
        `${protagonist} tackles a standalone case involving ${primaryTheme}`,
        `A new challenge tests ${protagonist}'s principles`,
        `${protagonist} helps a guest character with ${primaryTheme}`,
      ],
      anthology: [
        `A story about ${primaryTheme} in a new setting`,
        `Different characters face ${primaryTheme} in unexpected ways`,
      ],
      hybrid: [
        `${protagonist} deals with ${primaryTheme} while the season arc advances`,
        `Case of the week intersects with ${protagonist}'s personal journey`,
      ],
    };
    
    const arcTemplates = templates[arcType] ?? templates.serialized;
    return arcTemplates[(number - 1) % arcTemplates.length] ?? `Episode ${number}`;
  }

  /**
   * Generate episode summary
   */
  private generateEpisodeSummary(
    number: number,
    themes: string[],
    focusCharacters: string[],
    arcType: SeasonArcType,
    isPremiere: boolean,
    isFinale: boolean,
    isMidpoint: boolean
  ): string {
    if (isPremiere) {
      return `Season premiere. ${focusCharacters[0] || 'Our hero'} is introduced to the world and the central conflict of the season.`;
    }
    if (isFinale) {
      return `Season finale. All plot threads converge. ${focusCharacters[0] || 'The protagonist'} makes a choice that defines the season's theme.`;
    }
    if (isMidpoint) {
      return `Midpoint. A major revelation or event upends everything. The stakes become personal for ${focusCharacters[0] || 'our hero'}.`;
    }
    
    return `Episode ${number}. ${focusCharacters[0] || 'The protagonist'} navigates ${themes.join(', ')} while the season arc progresses.`;
  }

  /**
   * Get focus characters for episode
   */
  private getFocusCharactersForEpisode(
    episodeNumber: number,
    allCharacters: string[],
    episodeCount: number,
    arcType: SeasonArcType
  ): string[] {
    if (arcType === 'anthology') return [];
    if (allCharacters.length === 0) return [];
    
    // Rotate focus for ensemble shows
    const primary = allCharacters[0] ?? 'Protagonist';
    
    // Premiere and finale focus on protagonist
    if (episodeNumber === 1 || episodeNumber === episodeCount) {
      return [primary];
    }
    
    // Midpoint focuses on protagonist + antagonist/foil
    if (episodeNumber === Math.ceil(episodeCount / 2)) {
      return [primary, allCharacters[1] ?? primary];
    }
    
    // Rotate secondary focus
    const secIndex = ((episodeNumber - 2) % (allCharacters.length - 1 || 1)) + 1;
    return [primary, allCharacters[secIndex] ?? primary];
  }

  /**
   * Get key beats for episode
   */
  private getKeyBeatsForEpisode(
    number: number,
    isPremiere: boolean,
    isFinale: boolean,
    isMidpoint: boolean,
    arcType: SeasonArcType
  ): string[] {
    const beats: string[] = [];
    
    if (isPremiere) beats.push('hook', 'inciting');
    if (isFinale) beats.push('climax', 'resolution');
    if (isMidpoint) beats.push('complication', 'climax');
    
    beats.push('rising', 'character');
    return beats;
  }

  /**
   * Generate season logline
   */
  private generateSeasonLogline(
    seasonNumber: number,
    arcType: SeasonArcType,
    themes: SeasonTheme[]
  ): string {
    const primaryTheme = themes[0]?.theme || 'conflict';
    const secondaryTheme = themes[1]?.theme || 'identity';
    
    return `Season ${seasonNumber}: A ${arcType} journey exploring ${primaryTheme} and ${secondaryTheme} through interconnected character arcs.`;
  }

  /**
   * Get key plot points for episode
   */
  private getKeyPlotPointsForEpisode(
    episodeNumber: number,
    seasonStructure: {
      episodes: EpisodeSummary[];
      themes: SeasonTheme[];
    }
  ): string[] {
    const ep = seasonStructure.episodes[episodeNumber - 1];
    if (!ep) return [];
    return ep.keyBeats;
  }

  /**
   * Get themes for episode
   */
  private getThemesForEpisode(
    episodeNumber: number,
    seasonStructure: {
      episodes: EpisodeSummary[];
      themes: SeasonTheme[];
    }
  ): string[] {
    const ep = seasonStructure.episodes[episodeNumber - 1];
    if (!ep) return [];
    return ep.themes;
  }

  /**
   * Generate character season arcs from episode arcs
   */
  private generateCharacterSeasonArcs(
    focusCharacters: string[],
    episodePlans: EpisodePlan[],
    context: GenerationContext
  ): CharacterSeasonArc[] {
    const arcs: CharacterSeasonArc[] = [];
    
    for (const charName of focusCharacters) {
      const charEpisodes = episodePlans.map(ep => ({
        episode: ep.number,
        arcs: ep.characterArcs.filter(ca => ca.characterId === charName),
        beats: ep.beats.filter(b => b.characters.includes(charName)),
      })).filter(e => e.arcs.length > 0 || e.beats.length > 0);
      
      if (charEpisodes.length === 0) continue;
      
      const firstEp = charEpisodes[0]!;
      const lastEp = charEpisodes[charEpisodes.length - 1]!;
      
      const arc: CharacterSeasonArc = {
        characterId: charName,
        arcType: this.determineSeasonArcType(charEpisodes),
        startState: firstEp.arcs[0]?.startState ?? this.inferStartState(charName, context),
        endState: lastEp.arcs[0]?.endState ?? this.inferEndState(charName, lastEp.beats),
        milestones: charEpisodes.flatMap(e => 
          e.arcs.flatMap(a => a.beats.map(b => ({
            episodeNumber: e.episode,
            description: b,
            beatType: e.beats.find(beat => beat.id === b)?.type || 'unknown',
          })))
        ),
        keyEpisodes: charEpisodes
          .filter(e => e.beats.some(b => ['hook', 'inciting', 'climax', 'resolution', 'cliffhanger'].includes(b.type)))
          .map(e => e.episode),
        description: `${charName} undergoes a ${this.determineSeasonArcType(charEpisodes)} arc across ${charEpisodes.length} episodes.`,
      };
      
      arcs.push(arc);
    }
    
    return arcs;
  }

  /**
   * Determine season arc type from episode progression
   */
  private determineSeasonArcType(
    episodes: Array<{ episode: number; arcs: any[]; beats: any[] }>
  ): CharacterSeasonArc['arcType'] {
    // Simple heuristic based on beat progression
    const allBeats = episodes.flatMap(e => e.beats.map(b => b.type));
    const hasGrowth = allBeats.includes('growth');
    const hasRedemption = allBeats.some(b => ['resolution', 'climax'].includes(b) && allBeats.includes('complication'));
    const hasCorruption = allBeats.some(b => b === 'complication' && !allBeats.includes('resolution'));
    
    if (hasRedemption) return 'redemption';
    if (hasCorruption) return 'corruption';
    if (hasGrowth) return 'growth';
    if (allBeats.includes('inciting') && allBeats.includes('climax')) return 'discovery';
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
  private inferEndState(charName: string, beats: any[]): string {
    if (beats.length === 0) return 'No beats for this character';
    const lastBeat = beats[beats.length - 1];
    return `After ${lastBeat.type}: ${lastBeat.description?.substring(0, 100) || 'unknown'}`;
  }

  /**
   * Build season act structure
   */
  private buildSeasonActs(episodeCount: number, arcType: SeasonArcType): SeasonAct[] {
    if (arcType === 'episodic' || arcType === 'anthology') {
      // For episodic, acts are thematic groupings
      return [
        { number: 1, title: 'Act 1: Introduction', description: 'Establish world and characters', episodeRange: [1, Math.ceil(episodeCount/3)], theme: 'Setup', turningPoint: Math.ceil(episodeCount/3).toString() },
        { number: 2, title: 'Act 2: Exploration', description: 'Explore themes through cases', episodeRange: [Math.ceil(episodeCount/3)+1, Math.ceil(2*episodeCount/3)], theme: 'Development', turningPoint: Math.ceil(2*episodeCount/3).toString() },
        { number: 3, title: 'Act 3: Resolution', description: 'Bring themes to conclusion', episodeRange: [Math.ceil(2*episodeCount/3)+1, episodeCount], theme: 'Resolution', turningPoint: episodeCount.toString() },
      ];
    }
    
    // Serialized/hybrid: three-act structure
    const act1End = Math.ceil(episodeCount * 0.25);
    const act2End = Math.ceil(episodeCount * 0.75);
    
    return [
      { 
        number: 1, 
        title: 'Act 1: Setup', 
        description: 'Introduce characters, world, and central conflict', 
        episodeRange: [1, act1End], 
        theme: 'Inciting Incident & World Building', 
        turningPoint: act1End.toString() 
      },
      { 
        number: 2, 
        title: 'Act 2: Confrontation', 
        description: 'Escalating complications, character tests, mid-season climax', 
        episodeRange: [act1End + 1, act2End], 
        theme: 'Rising Action & Complications', 
        turningPoint: Math.ceil((act1End + act2End) / 2).toString() 
      },
      { 
        number: 3, 
        title: 'Act 3: Resolution', 
        description: 'Final confrontation and character arc conclusions', 
        episodeRange: [act2End + 1, episodeCount], 
        theme: 'Climax & Denouement', 
        turningPoint: episodeCount.toString() 
      },
    ];
  }
}

/**
 * Create default season planner
 */
export function createDefaultSeasonPlanner(
  episodePlanner: EpisodePlanner,
  orchestrator: GenerationOrchestrator,
  registry: ProviderRegistry,
  options?: SeasonPlannerOptions
): SeasonPlanner {
  return new SeasonPlanner(episodePlanner, orchestrator, registry, options);
}

/**
 * Quick season plan from minimal input
 */
export async function quickPlanSeason(
  episodePlanner: EpisodePlanner,
  orchestrator: GenerationOrchestrator,
  registry: ProviderRegistry,
  universeId: string,
  seasonNumber: number,
  context: GenerationContext,
  options?: SeasonPlannerOptions
): Promise<SeasonStructure> {
  const planner = createDefaultSeasonPlanner(episodePlanner, orchestrator, registry, options);
  return planner.generateSeasonPlan(universeId, seasonNumber, context, options);
}