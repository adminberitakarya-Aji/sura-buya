/**
 * Suro-Buya Engine v2 - Prompt Template System
 * 
 * Zod-validated prompt templates with few-shot registry support.
 */

import { z } from 'zod';
import type { GenerationContext, EngineConfig, GenerationOptions } from '../types.js';
import type { SceneGenerationInput, EpisodeGenerationInput } from '../types.js';

/**
 * Prompt template variable definition
 */
export const PromptVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean().default(true),
  defaultValue: z.unknown().optional(),
  example: z.unknown().optional(),
});

export type PromptVariable = z.infer<typeof PromptVariableSchema>;

/**
 * Few-shot example schema
 */
export const FewShotExampleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  input: z.record(z.unknown()),
  output: z.string(),
  tags: z.array(z.string()).default([]),
});

export type FewShotExample = z.infer<typeof FewShotExampleSchema>;

/**
 * Prompt template schema (Zod-validated)
 */
export const PromptTemplateSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum(['scene', 'episode', 'season', 'character', 'world', 'validation', 'planning', 'custom']),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  variables: z.array(PromptVariableSchema).default([]),
  fewShotExamples: z.array(FewShotExampleSchema).default([]),
  outputSchema: z.string().optional(), // JSON schema as string for structured output
  metadata: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

/**
 * Rendered prompt result
 */
export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
  variablesUsed: Record<string, unknown>;
  estimatedTokens: number;
  warnings: string[];
}

/**
 * Template registry for managing prompt templates
 */
export class PromptTemplateRegistry {
  private templates: Map<string, PromptTemplate> = new Map();
  private fewShotRegistry: Map<string, FewShotExample[]> = new Map();

  /**
   * Register a new prompt template
   */
  register(template: PromptTemplate): void {
    const validated = PromptTemplateSchema.parse(template);
    this.templates.set(validated.id, validated);
    
    // Index few-shot examples by tags
    for (const example of validated.fewShotExamples) {
      for (const tag of example.tags) {
        const existing = this.fewShotRegistry.get(tag) || [];
        existing.push(example);
        this.fewShotRegistry.set(tag, existing);
      }
    }
  }

  /**
   * Get a template by ID
   */
  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  list(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * Get few-shot examples by tag
   */
  getFewShotsByTag(tag: string): FewShotExample[] {
    return this.fewShotRegistry.get(tag) || [];
  }

  /**
   * Get few-shot examples by multiple tags (union)
   */
  getFewShotsByTags(tags: string[], maxExamples: number = 5): FewShotExample[] {
    const examples = new Map<string, FewShotExample>();
    
    for (const tag of tags) {
      for (const example of this.getFewShotsByTag(tag)) {
        examples.set(example.id, example);
      }
    }
    
    return Array.from(examples.values()).slice(0, maxExamples);
  }

  /**
   * Remove a template
   */
  remove(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) return false;
    
    // Remove few-shot examples from registry
    for (const example of template.fewShotExamples) {
      for (const tag of example.tags) {
        const existing = this.fewShotRegistry.get(tag) || [];
        const filtered = existing.filter(e => e.id !== example.id);
        if (filtered.length === 0) {
          this.fewShotRegistry.delete(tag);
        } else {
          this.fewShotRegistry.set(tag, filtered);
        }
      }
    }
    
    return this.templates.delete(id);
  }

  /**
   * Clear all templates
   */
  clear(): void {
    this.templates.clear();
    this.fewShotRegistry.clear();
  }

  /**
   * Get template count
   */
  size(): number {
    return this.templates.size;
  }
}

/**
 * Prompt renderer - builds prompts from templates and context
 */
export class PromptRenderer {
  private registry: PromptTemplateRegistry;

  constructor(registry: PromptTemplateRegistry) {
    this.registry = registry;
  }

  /**
   * Render a prompt template with variables and context
   */
  render(
    templateId: string,
    variables: Record<string, unknown>,
    context: GenerationContext,
    options: {
      includeFewShots?: boolean;
      fewShotTags?: string[];
      maxFewShots?: number;
    } = {}
  ): RenderedPrompt {
    const template = this.registry.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    const missingVars = template.variables
      .filter(v => v.required && !(v.name in variables))
      .map(v => v.name);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Merge with defaults
    const mergedVars = { ...template.variables.reduce((acc, v) => {
      if (v.defaultValue !== undefined) acc[v.name] = v.defaultValue;
      return acc;
    }, {} as Record<string, unknown>), ...variables };

    // Add context variables
    const contextVars = this.extractContextVariables(context);
    const allVars = { ...contextVars, ...mergedVars };

    // Render system prompt
    const systemPrompt = this.renderTemplate(template.systemPrompt, allVars);

    // Render user prompt with few-shots
    let userPrompt = this.renderTemplate(template.userPromptTemplate, allVars);

    const warnings: string[] = [];

    if (options.includeFewShots && template.fewShotExamples.length > 0) {
      const fewShots = options.fewShotTags?.length
        ? this.registry.getFewShotsByTags(options.fewShotTags, options.maxFewShots || 3)
        : template.fewShotExamples.slice(0, options.maxFewShots || 3);

      if (fewShots.length > 0) {
        const fewShotBlock = this.buildFewShotBlock(fewShots);
        userPrompt = `${fewShotBlock}\n\n---\n\n${userPrompt}`;
      }
    }

    // Estimate tokens
    const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt);

    return {
      systemPrompt,
      userPrompt,
      variablesUsed: allVars,
      estimatedTokens,
      warnings,
    };
  }

  /**
   * Render template for scene generation
   */
  renderScenePrompt(
    input: SceneGenerationInput,
    context: GenerationContext,
    options: GenerationOptions = {}
  ): RenderedPrompt {
    const variables = {
      universeName: context.universeConfig.name,
      universeId: context.universeConfig.id,
      storyTitle: context.storyProfile.title,
      storyLogline: context.storyProfile.logline,
      episodeTitle: context.episodeStructure?.title || 'Unknown',
      episodeSeason: context.episodeStructure?.season || 1,
      episodeNumber: context.episodeStructure?.number || 1,
      sceneNumber: input.sceneNumber,
      location: input.location,
      timeOfDay: input.timeOfDay,
      sceneType: input.type,
      estimatedDuration: input.estimatedDuration,
      characters: input.characters.map(id => context.characterBibles[id]).filter(Boolean),
      characterDescriptions: input.characters.map(id => {
        const char = context.characterBibles[id];
        return char ? `- ${char.name} (${char.archetype}): ${char.description}. Voice: ${char.voice?.tone || 'neutral'}` : '';
      }).filter(Boolean).join('\n'),
      keyBeats: input.keyBeats.map((b, i) => `${i + 1}. ${b}`).join('\n'),
      previousSceneSummary: input.previousSceneSummary || 'N/A',
      specialInstructions: input.specialInstructions || 'None',
      tone: context.storyProfile.tone,
    };

    return this.render('scene-generation', variables, context, {
      includeFewShots: true,
      fewShotTags: ['scene', input.type],
      maxFewShots: 3,
    });
  }

  /**
   * Render template for episode generation
   */
  renderEpisodePrompt(
    input: EpisodeGenerationInput,
    context: GenerationContext,
    options: GenerationOptions = {}
  ): RenderedPrompt {
    const variables = {
      universeName: context.universeConfig.name,
      universeId: context.universeConfig.id,
      storyTitle: context.storyProfile.title,
      storyLogline: context.storyProfile.logline,
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      episodeTitle: input.title,
      storyArc: input.storyArc || 'Main',
      targetRuntime: input.targetRuntime,
      sceneCount: input.sceneCount,
      focusCharacters: input.focusCharacters.join(', '),
      themes: input.themes.join(', '),
      keyPlotPoints: input.keyPlotPoints.map((p, i) => `${i + 1}. ${p}`).join('\n'),
    };

    return this.render('episode-generation', variables, context, {
      includeFewShots: true,
      fewShotTags: ['episode', 'planning'],
      maxFewShots: 2,
    });
  }

  /**
   * Extract context variables for template rendering
   */
  private extractContextVariables(context: GenerationContext): Record<string, unknown> {
    return {
      universe: {
        id: context.universeConfig.id,
        name: context.universeConfig.name,
        version: context.universeConfig.version,
        locale: context.universeConfig.locale,
      },
      story: {
        title: context.storyProfile.title,
        logline: context.storyProfile.logline,
        genre: context.storyProfile.genre,
        themes: context.storyProfile.themes,
        tone: context.storyProfile.tone,
      },
      episode: context.episodeStructure ? {
        number: context.episodeStructure.number,
        season: context.episodeStructure.season,
        title: context.episodeStructure.title,
        summary: context.episodeStructure.summary,
      } : null,
      characters: Object.values(context.characterBibles).map(c => ({
        id: c.id,
        name: c.name,
        archetype: c.archetype,
        description: c.description,
        voice: c.voice,
      })),
      worlds: Object.values(context.worldBibles).map(w => ({
        id: w.id,
        name: w.name,
        type: w.type,
        description: w.description,
      })),
    };
  }

  /**
   * Simple template rendering ({{variable}} syntax)
   */
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined || value === null) {
        return `{{${key}}}`;
      }
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }

  /**
   * Build few-shot examples block
   */
  private buildFewShotBlock(examples: FewShotExample[]): string {
    const blocks = examples.map(ex => 
      `EXAMPLE: ${ex.name}\n${ex.description ? `Description: ${ex.description}\n` : ''}Input:\n${JSON.stringify(ex.input, null, 2)}\n\nOutput:\n${ex.output}`
    );
    return `FEW-SHOT EXAMPLES:\n\n${blocks.join('\n\n---\n\n')}`;
  }

  /**
   * Rough token estimation
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Default prompt templates for the engine
 */
export function createDefaultTemplates(): PromptTemplate[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'scene-generation',
      name: 'Scene Generation',
      version: '1.0.0',
      category: 'scene',
      description: 'Generate a screenplay scene from beats and context',
      systemPrompt: `You are an expert screenwriter for the "{{universeName}}" universe. Write compelling, character-driven scenes in professional screenplay format.

UNIVERSE: {{universeName}} ({{universeId}})
STORY: {{storyTitle}} - {{storyLogline}}
TONE: {{tone}}
GENRE: {{genre.join(", ")}}`,
      userPromptTemplate: `SCENE GENERATION REQUEST

EPISODE: {{episodeTitle}} (S{{episodeSeason}}E{{episodeNumber}})
SCENE: #{{sceneNumber}}
LOCATION: {{location}}
TIME: {{timeOfDay}}
TYPE: {{sceneType}}
DURATION: ~{{estimatedDuration}} minutes

CHARACTERS PRESENT:
{{characterDescriptions}}

PREVIOUS SCENE: {{previousSceneSummary}}

KEY BEATS:
{{keyBeats}}

SPECIAL INSTRUCTIONS: {{specialInstructions}}

FORMAT: Professional screenplay format with scene heading, action lines, character names, dialogue, and parentheticals.
Write the complete scene now.`,
      variables: [
        { name: 'universeName', description: 'Universe name', type: 'string', required: true },
        { name: 'universeId', description: 'Universe ID', type: 'string', required: true },
        { name: 'storyTitle', description: 'Story title', type: 'string', required: true },
        { name: 'storyLogline', description: 'Story logline', type: 'string', required: true },
        { name: 'genre', description: 'Story genres', type: 'array', required: true },
        { name: 'tone', description: 'Story tone', type: 'string', required: true },
        { name: 'episodeTitle', description: 'Episode title', type: 'string', required: true },
        { name: 'episodeSeason', description: 'Season number', type: 'number', required: true },
        { name: 'episodeNumber', description: 'Episode number', type: 'number', required: true },
        { name: 'sceneNumber', description: 'Scene number', type: 'number', required: true },
        { name: 'location', description: 'Scene location', type: 'string', required: true },
        { name: 'timeOfDay', description: 'Time of day', type: 'string', required: true },
        { name: 'sceneType', description: 'Scene type', type: 'string', required: true },
        { name: 'estimatedDuration', description: 'Estimated duration in minutes', type: 'number', required: true },
        { name: 'characterDescriptions', description: 'Character descriptions', type: 'string', required: true },
        { name: 'keyBeats', description: 'Key story beats', type: 'string', required: true },
        { name: 'previousSceneSummary', description: 'Previous scene summary', type: 'string', required: false, defaultValue: 'N/A' },
        { name: 'specialInstructions', description: 'Special instructions', type: 'string', required: false, defaultValue: 'None' },
      ],
      fewShotExamples: [
        {
          id: 'scene-ex-1',
          name: 'Dialogue Scene - Cafe',
          description: 'Two characters talking in a cafe',
          tags: ['scene', 'dialogue', 'cafe'],
          input: {
            location: 'Cafe',
            timeOfDay: 'afternoon',
            sceneType: 'dialogue',
            characters: ['hero', 'mentor'],
            keyBeats: ['Hero asks for advice', 'Mentor gives cryptic guidance'],
          },
          output: `SCENE 3: CAFE - AFTERNOON

A cozy corner cafe. Rain taps against the window.

HERO (20s, determined but uncertain) sits across from MENTOR (50s, wise, weathered).

MENTOR
You're asking the wrong question.

HERO
Then what's the right one?

Mentor leans back, studying Hero.

MENTOR
The question isn't what you should do. It's who you're willing to become.`,
        },
        {
          id: 'scene-ex-2',
          name: 'Action Scene - Chase',
          description: 'High-stakes chase sequence',
          tags: ['scene', 'action', 'chase'],
          input: {
            location: 'Market Street',
            timeOfDay: 'night',
            sceneType: 'action',
            characters: ['hero', 'antagonist'],
            keyBeats: ['Hero spots antagonist', 'Chase through crowded market', 'Hero corners antagonist'],
          },
          output: `SCENE 5: MARKET STREET - NIGHT

Neon lights reflect on wet pavement. Crowds surge.

HERO spots ANTAGONIST slipping through the crowd.

HERO
Hey!

Antagonist bolts. Hero gives chase.

Hero vaults a fruit cart. Slides under a food truck. The market becomes an obstacle course.

Antagonist ducks into an alley. Hero follows.

DEAD END.

Hero corners Antagonist against a chain-link fence.`,
        },
      ],
      outputSchema: JSON.stringify({
        type: 'object',
        properties: {
          scene: { type: 'string' },
          metadata: { type: 'object' },
        },
        required: ['scene'],
      }),
      metadata: { format: 'screenplay' },
      tags: ['generation', 'screenplay', 'scene'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'episode-generation',
      name: 'Episode Structure Generation',
      version: '1.0.0',
      category: 'episode',
      description: 'Generate episode structure with scene breakdowns',
      systemPrompt: `You are a TV series writer and story architect for the "{{universeName}}" universe. Design compelling episode structures that advance character arcs and plot.

UNIVERSE: {{universeName}} ({{universeId}})
STORY: {{storyTitle}} - {{storyLogline}}`,
      userPromptTemplate: `EPISODE GENERATION REQUEST

SEASON: {{seasonNumber}}
EPISODE: {{episodeNumber}} - "{{episodeTitle}}"
ARC: {{storyArc}}
RUNTIME: ~{{targetRuntime}} minutes
SCENES: {{sceneCount}}

FOCUS CHARACTERS: {{focusCharacters}}
THEMES: {{themes}}

KEY PLOT POINTS:
{{keyPlotPoints}}

GENERATE: Complete episode structure with {{sceneCount}} scenes. For each scene provide:
1. Scene number
2. Location
3. Characters present
4. Summary (2-3 sentences)
5. Type (exposition/dialogue/action/climax/resolution/transition)
6. Estimated duration in minutes

Ensure proper dramatic structure: setup → inciting → rising → climax → falling → resolution.`,
      variables: [
        { name: 'universeName', description: 'Universe name', type: 'string', required: true },
        { name: 'universeId', description: 'Universe ID', type: 'string', required: true },
        { name: 'storyTitle', description: 'Story title', type: 'string', required: true },
        { name: 'storyLogline', description: 'Story logline', type: 'string', required: true },
        { name: 'seasonNumber', description: 'Season number', type: 'number', required: true },
        { name: 'episodeNumber', description: 'Episode number', type: 'number', required: true },
        { name: 'episodeTitle', description: 'Episode title', type: 'string', required: true },
        { name: 'storyArc', description: 'Story arc identifier', type: 'string', required: true },
        { name: 'targetRuntime', description: 'Target runtime in minutes', type: 'number', required: true },
        { name: 'sceneCount', description: 'Number of scenes', type: 'number', required: true },
        { name: 'focusCharacters', description: 'Focus characters', type: 'string', required: true },
        { name: 'themes', description: 'Episode themes', type: 'string', required: true },
        { name: 'keyPlotPoints', description: 'Key plot points', type: 'string', required: true },
      ],
      fewShotExamples: [
        {
          id: 'episode-ex-1',
          name: 'Pilot Episode Structure',
          description: 'Standard pilot episode with 6 scenes',
          tags: ['episode', 'planning', 'pilot'],
          input: {
            seasonNumber: 1,
            episodeNumber: 1,
            episodeTitle: 'Pilot',
            targetRuntime: 22,
            sceneCount: 6,
            focusCharacters: ['hero', 'sidekick'],
            themes: ['discovery', 'friendship'],
            keyPlotPoints: ['Hero discovers power', 'Meets sidekick', 'First challenge'],
          },
          output: `EPISODE STRUCTURE: S01E01 - "Pilot"

SCENE 1: HERO'S BEDROOM - MORNING (exposition, 3 min)
Hero wakes up, discovers strange ability. Establishes normal world.

SCENE 2: SCHOOL HALLWAY - DAY (dialogue, 4 min)
Hero meets Sidekick. Comedic interaction. Establishes dynamic.

SCENE 3: SCIENCE LAB - DAY (action, 4 min)
First manifestation of power. Accidental. Chaos ensues.

SCENE 4: ROOFTOP - SUNSET (exposition, 3 min)
Hero and Sidekick process what happened. Bond forms.

SCENE 5: CITY STREET - NIGHT (climax, 5 min)
First real threat appears. Hero must use power intentionally.

SCENE 6: HERO'S BEDROOM - NIGHT (resolution, 3 min)
New status quo established. Hook for episode 2.`,
        },
      ],
      metadata: { format: 'episode-structure' },
      tags: ['generation', 'planning', 'episode'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'canon-validation',
      name: 'Canon Validation',
      version: '1.0.0',
      category: 'validation',
      description: 'Validate content against universe canon rules',
      systemPrompt: `You are a canon consistency checker for the "{{universeName}}" universe. Analyze the provided content for violations of established canon rules, character consistency, and world logic.

UNIVERSE: {{universeName}} ({{universeId}})
CANON RULES: {{canonRules}}`,
      userPromptTemplate: `VALIDATE THE FOLLOWING CONTENT:

CONTENT TYPE: {{contentType}}
CONTENT:
{{content}}

CHARACTERS INVOLVED: {{characters}}
LOCATION: {{location}}

CHECK FOR:
1. Character voice consistency
2. World logic violations
3. Canon rule violations
4. Timeline/continuity issues
5. Power/ability consistency

RESPOND WITH JSON:
{
  "passed": boolean,
  "issues": [
    {
      "rule": "rule-id",
      "severity": "ERROR|WARNING|INFO",
      "message": "description",
      "location": "text location",
      "suggestion": "fix suggestion"
    }
  ],
  "consistencyScore": 0.0-1.0
}`,
      variables: [
        { name: 'universeName', description: 'Universe name', type: 'string', required: true },
        { name: 'universeId', description: 'Universe ID', type: 'string', required: true },
        { name: 'canonRules', description: 'Canon rules summary', type: 'string', required: true },
        { name: 'contentType', description: 'Content type', type: 'string', required: true },
        { name: 'content', description: 'Content to validate', type: 'string', required: true },
        { name: 'characters', description: 'Characters involved', type: 'string', required: false, defaultValue: 'None' },
        { name: 'location', description: 'Location', type: 'string', required: false, defaultValue: 'Unknown' },
      ],
      fewShotExamples: [],
      metadata: { format: 'validation' },
      tags: ['validation', 'canon', 'consistency'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'character-voice',
      name: 'Character Voice Consistency',
      version: '1.0.0',
      category: 'character',
      description: 'Ensure character dialogue matches established voice',
      systemPrompt: `You are a character voice specialist for the "{{universeName}}" universe. Analyze dialogue to ensure each character speaks in their established voice.

CHARACTER VOICE GUIDES:
{{voiceGuides}}`,
      userPromptTemplate: `ANALYZE DIALOGUE FOR VOICE CONSISTENCY:

SCENE CONTEXT: {{sceneContext}}
CHARACTERS: {{characters}}

DIALOGUE TO CHECK:
{{dialogue}}

FOR EACH CHARACTER, CHECK:
- Vocabulary level and word choice
- Speech patterns and rhythm
- Catchphrases and verbal tics
- Emotional expression style
- Formality level

RESPOND WITH JSON:
{
  "consistent": boolean,
  "analysis": [
    {
      "character": "character-id",
      "consistent": boolean,
      "issues": ["issue description"],
      "suggestions": ["suggestion"]
    }
  ]
}`,
      variables: [
        { name: 'universeName', description: 'Universe name', type: 'string', required: true },
        { name: 'voiceGuides', description: 'Character voice guides', type: 'string', required: true },
        { name: 'sceneContext', description: 'Scene context', type: 'string', required: true },
        { name: 'characters', description: 'Characters in scene', type: 'string', required: true },
        { name: 'dialogue', description: 'Dialogue to analyze', type: 'string', required: true },
      ],
      fewShotExamples: [],
      metadata: { format: 'voice-analysis' },
      tags: ['character', 'voice', 'consistency'],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Create and populate default registry
 */
export function createDefaultRegistry(): PromptTemplateRegistry {
  const registry = new PromptTemplateRegistry();
  for (const template of createDefaultTemplates()) {
    registry.register(template);
  }
  return registry;
}

/**
 * Create default renderer with registry
 */
export function createDefaultRenderer(): PromptRenderer {
  return new PromptRenderer(createDefaultRegistry());
}