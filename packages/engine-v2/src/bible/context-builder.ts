/**
 * Suro-Buya Engine v2 - Context Builder
 * 
 * Builds LLM prompts with relevant bible context, token-aware.
 */

import type { 
  GenerationContext, 
  SceneGenerationInput, 
  EpisodeGenerationInput,
  CharacterProfile,
  WorldProfile,
  StoryProfile,
  EpisodeStructure,
  SceneData 
} from '../types.js';
import { 
  BibleLoader, 
  BibleFile, 
  BibleIndex, 
  BibleKey,
  ContextRequest, 
  ContextResult,
  TokenBudget,
  BibleSection,
  DEFAULT_TOKEN_BUDGETS 
} from './types.js';
import { BibleIndexer, IndexedSection } from './indexer.js';

/**
 * Context builder configuration
 */
export interface ContextBuilderConfig {
  /** Maximum tokens for bible context section */
  maxBibleTokens: number;
  /** Include character bibles by default */
  includeCharacterBibles: boolean;
  /** Include world bibles by default */
  includeWorldBibles: boolean;
  /** Include story bible by default */
  includeStoryBible: boolean;
  /** Include episode structure by default */
  includeEpisodeStructure: boolean;
  /** Include previous scenes by default */
  includePreviousScenes: number; // number of previous scenes
}

/**
 * Default context builder configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextBuilderConfig = {
  maxBibleTokens: 4000,
  includeCharacterBibles: true,
  includeWorldBibles: true,
  includeStoryBible: true,
  includeEpisodeStructure: true,
  includePreviousScenes: 3,
};

/**
 * Context builder class
 */
export class ContextBuilder {
  private loader: BibleLoader;
  private indexer: BibleIndexer;
  private config: ContextBuilderConfig;

  constructor(
    loader: BibleLoader,
    indexer: BibleIndexer,
    config: Partial<ContextBuilderConfig> = {}
  ) {
    this.loader = loader;
    this.indexer = indexer;
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
  }

  /**
   * Build context for scene generation
   */
  async buildSceneContext(
    input: SceneGenerationInput,
    context: GenerationContext,
    budget?: TokenBudget
  ): Promise<ContextResult> {
    const taskBudget = budget || DEFAULT_TOKEN_BUDGETS.scene;
    
    // Build context request
    const request: ContextRequest = {
      universeId: input.universeId,
      task: 'scene',
      characters: input.characters,
      premise: this.buildScenePremise(input),
      tokenBudget: taskBudget.bibleContext,
    };

    return this.buildContext(request, context, taskBudget);
  }

  /**
   * Build context for episode generation
   */
  async buildEpisodeContext(
    input: EpisodeGenerationInput,
    context: GenerationContext,
    budget?: TokenBudget
  ): Promise<ContextResult> {
    const taskBudget = budget || DEFAULT_TOKEN_BUDGETS.episode;
    
    const request: ContextRequest = {
      universeId: input.universeId,
      task: 'episode',
      characters: input.focusCharacters,
      premise: this.buildEpisodePremise(input),
      tokenBudget: taskBudget.bibleContext,
    };

    return this.buildContext(request, context, taskBudget);
  }

  /**
   * Build context for validation
   */
  async buildValidationContext(
    content: string,
    contentType: 'scene' | 'episode' | 'story' | 'character' | 'world',
    context: GenerationContext,
    budget?: TokenBudget
  ): Promise<ContextResult> {
    const taskBudget = budget || DEFAULT_TOKEN_BUDGETS.validation;
    
    const request: ContextRequest = {
      universeId: context.universeConfig.id,
      task: 'validation',
      premise: `Validate ${contentType} content for canon compliance`,
      additionalContext: { content },
      tokenBudget: taskBudget.bibleContext,
    };

    return this.buildContext(request, context, taskBudget);
  }

  /**
   * Generic context builder
   */
  async buildContext(
    request: ContextRequest,
    context: GenerationContext,
    budget: TokenBudget
  ): Promise<ContextResult> {
    const warnings: string[] = [];
    const contextFiles: BibleFile[] = [];
    let bibleTokensUsed = 0;

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(request, context, budget);

    // Collect bible files based on request
    const sections = await this.collectBibleSections(request, context);
    
    // Sort by priority and fit within token budget
    const selectedSections = this.selectSectionsByBudget(sections, budget.bibleContext);
    
    for (const section of selectedSections) {
      const file = await this.loader.load(section.id as BibleKey);
      if (file) {
        contextFiles.push(file);
        bibleTokensUsed += section.tokens;
      }
    }

    if (bibleTokensUsed > budget.bibleContext) {
      warnings.push(`Bible context (${bibleTokensUsed} tokens) exceeds budget (${budget.bibleContext} tokens)`);
    }

    // Build user prompt with task-specific content
    const userPrompt = this.buildUserPrompt(request, context, selectedSections, budget);

    const estimatedTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt);

    return {
      systemPrompt,
      userPrompt,
      contextFiles,
      estimatedTokens,
      warnings,
    };
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(
    request: ContextRequest,
    context: GenerationContext,
    budget: TokenBudget
  ): string {
    const universe = context.universeConfig;
    const story = context.storyProfile;

    let prompt = `# SYSTEM PROMPT: ${universe.name} Universe Writer

You are an expert writer for the "${universe.name}" universe (${universe.id}).
Your role is to generate content that strictly adheres to established canon.

## UNIVERSE OVERVIEW
**Title: ${story.title}
**Logline:** ${story.logline}
**Genre:** ${story.genre.join(', ')}
**Tone:** ${story.tone}
**Themes:** ${story.themes.join(', ')}
**Audience:** ${story.audience}

## CANON RULES (MANDATORY)
1. **Character Consistency**: Never contradict established character traits, voices, relationships, or arcs.
2. **World Consistency**: Locations, history, culture, and geography must match world bible.
3. **Timeline Consistency**: Events must follow established chronological order.
4. **Format Compliance**: Use screenplay format for scenes (scene headings, action, dialogue).
5. **Tone Adherence**: Maintain the established tone (${story.tone}).

## WRITING GUIDELINES
- Show, don't tell
- Each scene must advance plot or character
- Dialogue must sound natural and character-specific
- Include sensory details (visual, audio)
- Respect episode formula and season structure

## TASK: ${request.task.toUpperCase()}
${this.getTaskInstructions(request.task)}`;

    return prompt;
  }

  /**
   * Get task-specific instructions
   */
  private getTaskInstructions(task: ContextRequest['task']): string {
    const instructions: Record<ContextRequest['task'], string> = {
      scene: `
Generate a single scene in screenplay format.
Include: Scene heading (INT./EXT. LOCATION - TIME), action lines, character dialogue.
Follow the key beats provided. Maintain character voices from voice guide.`,
      episode: `
Generate an episode structure with multiple scenes.
Each scene needs: number, location, characters, summary, type, estimated duration.
Follow the episode formula. Distribute plot points across scenes.`,
      season: `
Generate a season arc with episode breakdowns.
Include: episode titles, summaries, character arc progressions, major plot points.
Follow the season structure template.`,
      character: `
Create a detailed character profile following the character bible template.
Include: name, archetype, description, backstory, traits, voice, relationships, arc.`,
      world: `
Create a detailed world/location profile following the world bible template.
Include: name, type, description, geography, culture, history, connections.`,
      validation: `
Analyze the provided content for canon violations.
Check: character consistency, world consistency, timeline, format, tone.
Report violations with severity (error/warning/info) and suggestions.`,
    };
    return instructions[task];
  }

  /**
   * Build user prompt with context sections
   */
  private buildUserPrompt(
    request: ContextRequest,
    context: GenerationContext,
    sections: BibleSection[],
    budget: TokenBudget
  ): string {
    let prompt = `# USER PROMPT: ${request.task.toUpperCase()} GENERATION

## PREMISE
${request.premise}

`;

    // Add bible context sections
    if (sections.length > 0) {
      prompt += `## RELEVANT BIBLE CONTEXT (${sections.reduce((sum, s) => sum + s.tokens, 0)} tokens)

`;
      
      // Group by type
      const byType = new Map<string, BibleSection[]>();
      for (const section of sections) {
        const type = section.id.split(':')[0] || 'general';
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push(section);
      }

      for (const [type, typeSections] of byType) {
        prompt += `### ${type.toUpperCase().replace(/-/g, ' ')}\n\n`;
        for (const section of typeSections) {
          prompt += `#### ${section.title} (${section.tokens} tokens)\n${section.content}\n\n`;
        }
      }
    }

    // Add task-specific context
    switch (request.task) {
      case 'scene':
        prompt += this.buildSceneTaskContext(request, context);
        break;
      case 'episode':
        prompt += this.buildEpisodeTaskContext(request, context);
        break;
      case 'validation':
        prompt += this.buildValidationTaskContext(request);
        break;
    }

    // Add format reminder
    prompt += `## FORMAT REQUIREMENTS
${this.getFormatRequirements(request.task)}

## OUTPUT
Generate only the requested content. No meta-commentary.`;

    return prompt;
  }

  /**
   * Build scene-specific task context
   */
  private buildSceneTaskContext(request: ContextRequest, context: GenerationContext): string {
    // Parse scene info from premise
    const lines = request.premise.split('\n');
    const sceneInfo: Record<string, string> = {};
    for (const line of lines) {
      const [key, ...value] = line.split(':');
      if (key && value.length > 0) {
        sceneInfo[key.trim().toLowerCase()] = value.join(':').trim();
      }
    }

    let taskContext = `## SCENE SPECIFICATIONS
`;

    if (sceneInfo['scene']) taskContext += `**Scene:** ${sceneInfo['scene']}\n`;
    if (sceneInfo['location']) taskContext += `**Location:** ${sceneInfo['location']}\n`;
    if (sceneInfo['time']) taskContext += `**Time:** ${sceneInfo['time']}\n`;
    if (sceneInfo['type']) taskContext += `**Type:** ${sceneInfo['type']}\n`;
    if (sceneInfo['duration']) taskContext += `**Duration:** ${sceneInfo['duration']} minutes\n`;
    if (sceneInfo['characters']) taskContext += `**Characters:** ${sceneInfo['characters']}\n`;
    if (sceneInfo['beats']) taskContext += `**Key Beats:** ${sceneInfo['beats']}\n`;

    // Add episode context
    if (context.episodeStructure) {
      taskContext += `\n## EPISODE CONTEXT
**Episode:** S${context.episodeStructure.season}E${context.episodeStructure.number} - ${context.episodeStructure.title}
**Summary:** ${context.episodeStructure.summary}
`;
    }

    // Add previous scenes
    if (context.previousScenes.length > 0 && this.config.includePreviousScenes > 0) {
      const prevScenes = context.previousScenes.slice(-this.config.includePreviousScenes);
      taskContext += `\n## PREVIOUS SCENES\n`;
      for (const scene of prevScenes) {
        taskContext += `- Scene ${scene.number}: ${scene.location} - ${scene.beats.map(b => b.description).join('; ')}\n`;
      }
    }

    return taskContext + '\n';
  }

  /**
   * Build episode-specific task context
   */
  private buildEpisodeTaskContext(request: ContextRequest, context: GenerationContext): string {
    let taskContext = `## EPISODE SPECIFICATIONS
`;

    const lines = request.premise.split('\n');
    for (const line of lines) {
      const [key, ...value] = line.split(':');
      if (key && value.length > 0) {
        taskContext += `**${key.trim()}:** ${value.join(':').trim()}\n`;
      }
    }

    // Add season context
    if (context.episodeStructure) {
      taskContext += `\n## SEASON CONTEXT
**Season:** ${context.episodeStructure.season}
**Episode:** ${context.episodeStructure.number}
`;

      if (context.storyProfile.structure) {
        taskContext += `**Act Structure:** ${context.storyProfile.structure.acts} acts\n`;
        taskContext += `**Story Beats:** ${context.storyProfile.structure.beats.join(', ')}\n`;
      }
    }

    return taskContext + '\n';
  }

  /**
   * Build validation task context
   */
  private buildValidationTaskContext(request: ContextRequest): string {
    const content = request.additionalContext?.['content'] ?? '';
    return `## CONTENT TO VALIDATE
\`\`\`
${content}
\`\`\`

## VALIDATION CRITERIA
Check against all loaded bible context for:
1. Character name/voice consistency
2. World location/lore accuracy
3. Timeline/event order
4. Format compliance (screenplay)
5. Tone adherence
`;
  }

  /**
   * Get format requirements for task
   */
  private getFormatRequirements(task: ContextRequest['task']): string {
    const formats: Record<ContextRequest['task'], string> = {
      scene: `Screenplay format:
- Scene heading: INT./EXT. LOCATION - TIME
- Action lines in present tense
- Character names in CAPS before dialogue
- Parentheticals for delivery notes
- Scene transitions (CUT TO:, FADE OUT:)`,
      episode: `JSON structure with:
- title, summary, themes, characterArcs
- scenes array: number, location, characters, summary, type, estimatedDuration`,
      season: `JSON structure with:
- season number, theme, episode count
- episodes array with titles, summaries, arc progressions`,
      character: `JSON structure matching CharacterProfile schema`,
      world: `JSON structure matching WorldProfile schema`,
      validation: `JSON structure with:
- valid (boolean)
- consistencyScore (0-1)
- violations array: rule, severity, location, expected, actual, suggestion
- errors, warnings, infos arrays`,
    };
    return formats[task];
  }

  /**
   * Build scene premise string
   */
  private buildScenePremise(input: SceneGenerationInput): string {
    return `scene: ${input.sceneNumber}
location: ${input.location}
time: ${input.timeOfDay}
type: ${input.type}
duration: ${input.estimatedDuration}
characters: ${input.characters.join(', ')}
beats: ${input.keyBeats.join('; ')}
${input.previousSceneSummary ? `previous: ${input.previousSceneSummary}` : ''}
${input.specialInstructions ? `instructions: ${input.specialInstructions}` : ''}`;
  }

  /**
   * Build episode premise string
   */
  private buildEpisodePremise(input: EpisodeGenerationInput): string {
    return `season: ${input.seasonNumber}
episode: ${input.episodeNumber}
title: ${input.title}
arc: ${input.storyArc || 'main'}
runtime: ${input.targetRuntime}
scenes: ${input.sceneCount}
characters: ${input.focusCharacters.join(', ')}
plotPoints: ${input.keyPlotPoints.join('; ')}
themes: ${input.themes.join(', ')}`;
  }

  /**
   * Collect relevant bible sections based on request
   */
  private async collectBibleSections(
    request: ContextRequest,
    context: GenerationContext
  ): Promise<BibleSection[]> {
    const sections: BibleSection[] = [];

    // Always include core bibles if enabled
    if (this.config.includeStoryBible) {
      // Canon rules
      const canonRules = await this.loader.load('canonRules');
      if (canonRules) {
        sections.push({
          id: 'canonRules',
          title: 'Canon Rules',
          content: canonRules.content,
          tokens: canonRules.tokens,
          priority: 100,
          required: true,
        });
      }

      // Voice guide
      const voiceGuide = await this.loader.load('voiceGuide');
      if (voiceGuide) {
        sections.push({
          id: 'voiceGuide',
          title: 'Voice Guide',
          content: voiceGuide.content,
          tokens: voiceGuide.tokens,
          priority: 90,
          required: true,
        });
      }

      // Episode formula
      const episodeFormula = await this.loader.load('episodeFormula');
      if (episodeFormula) {
        sections.push({
          id: 'episodeFormula',
          title: 'Episode Formula',
          content: episodeFormula.content,
          tokens: episodeFormula.tokens,
          priority: 80,
          required: true,
        });
      }
    }

    // Include character bibles for requested characters
    if (this.config.includeCharacterBibles && request.characters) {
      for (const charId of request.characters) {
        const charBible = await this.loader.load(`character:${charId}`);
        if (charBible) {
          sections.push({
            id: `character:${charId}`,
            title: `Character: ${charId}`,
            content: charBible.content,
            tokens: charBible.tokens,
            priority: 95,
            required: true,
          });
        }
      }

      // Also load character overview
      const charOverview = await this.loader.load('characterOverview');
      if (charOverview) {
        sections.push({
          id: 'characterOverview',
          title: 'Character Overview',
          content: charOverview.content,
          tokens: charOverview.tokens,
          priority: 70,
          required: false,
        });
      }
    }

    // Include world bible for region
    if (this.config.includeWorldBibles) {
      // Search for relevant regions
      const searchResults = this.indexer.search({
        query: request.premise,
        type: 'region',
        limit: 3,
      });

      for (const result of searchResults) {
        const regionId = result.section.metadata['regionId'] as string;
        const regionBible = await this.loader.load(`region:${regionId}`);
        if (regionBible) {
          sections.push({
            id: `region:${regionId}`,
            title: `Region: ${regionId}`,
            content: regionBible.content,
            tokens: regionBible.tokens,
            priority: 85,
            required: false,
          });
        }
      }
    }

    // Include relationship dynamics
    const relationships = await this.loader.load('relationshipDynamic');
    if (relationships) {
      sections.push({
        id: 'relationshipDynamic',
        title: 'Relationship Dynamics',
        content: relationships.content,
        tokens: relationships.tokens,
        priority: 60,
        required: false,
      });
    }

    return sections;
  }

  /**
   * Select sections that fit within token budget
   */
  private selectSectionsByBudget(sections: BibleSection[], budget: number): BibleSection[] {
    // Sort by priority (required first, then by priority desc)
    const sorted = [...sections].sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return b.priority - a.priority;
    });

    const selected: BibleSection[] = [];
    let tokensUsed = 0;

    for (const section of sorted) {
      if (tokensUsed + section.tokens <= budget || section.required) {
        selected.push(section);
        tokensUsed += section.tokens;
      }
    }

    return selected;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create a context builder instance
 */
export function createContextBuilder(
  loader: BibleLoader,
  indexer: BibleIndexer,
  config?: Partial<ContextBuilderConfig>
): ContextBuilder {
  return new ContextBuilder(loader, indexer, config);
}