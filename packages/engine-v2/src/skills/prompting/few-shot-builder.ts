/**
 * Suro-Buya Engine v2 - Few Shot Builder Skill
 * 
 * Builds few-shot examples for prompt optimization.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { PromptingSkill } from '../base.js';

export const FewShotExampleSchema = z.object({
  id: z.string(),
  input: z.string(),
  output: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  qualityScore: z.number().min(0).max(1).optional(),
});

export type FewShotExample = z.infer<typeof FewShotExampleSchema>;

export interface FewShotBuilderConfig extends Record<string, unknown> {
  maxExamples: number;
  minQualityScore: number;
  enableDynamicSelection: boolean;
  categories?: string[];
  template?: string;
}

export interface FewShotBuilderInput {
  task: string;
  context?: string;
  availableExamples?: FewShotExample[];
  config?: Partial<FewShotBuilderConfig>;
}

export interface FewShotBuilderOutput {
  examples: FewShotExample[];
  promptTemplate: string;
  selectedCount: number;
  totalAvailable: number;
}

const defaultConfig: FewShotBuilderConfig = {
  maxExamples: 5,
  minQualityScore: 0.7,
  enableDynamicSelection: true,
  template: `Examples:\n{{#each examples}}\nInput: {{this.input}}\nOutput: {{this.output}}\n{{/each}}\n\nNow complete:\nInput: {{input}}\nOutput:`,
};

export class FewShotBuilder extends PromptingSkill<FewShotBuilderInput, FewShotBuilderOutput> {
  override name = 'FewShotBuilder';
  override version = '1.0.0';
  override description = 'Builds few-shot examples for prompt optimization';
  override dependencies: string[] = [];
  override required = false;
  
  override configSchema = z.object({
    maxExamples: z.number().int().positive().default(5),
    minQualityScore: z.number().min(0).max(1).default(0.7),
    enableDynamicSelection: z.boolean().default(true),
    categories: z.array(z.string()).optional(),
    template: z.string().optional(),
  });

  override defaultConfig: Record<string, unknown> = {
    maxExamples: 5,
    minQualityScore: 0.7,
    enableDynamicSelection: true,
  };

  protected override config: Record<string, unknown> = { ...defaultConfig };

  private exampleLibrary: Map<string, FewShotExample[]> = new Map();

  override async initialize(config?: Record<string, unknown>): Promise<void> {
    await super.initialize(config);
    this.config = { ...defaultConfig, ...config } as FewShotBuilderConfig;
    this.initializeDefaultExamples();
  }

  private initializeDefaultExamples(): void {
    // Screenplay formatting examples
    this.exampleLibrary.set('screenplay-formatting', [
      {
        id: 'sf-001',
        input: 'INT. COFFEE SHOP - DAY\nJohn sits at a table, typing on his laptop.',
        output: 'INT. COFFEE SHOP - DAY\n\nJohn sits at a corner table, fingers flying across his laptop keyboard. Steam rises from his untouched coffee.',
        description: 'Show, don\'t tell - add sensory details',
        category: 'screenplay-formatting',
        qualityScore: 0.95,
      },
      {
        id: 'sf-002',
        input: 'John is angry.',
        output: 'John\'s jaw tightens. His knuckles whiten around the coffee cup. He doesn\'t speak.',
        description: 'Show emotion through action',
        category: 'screenplay-formatting',
        qualityScore: 0.9,
      },
    ]);

    // Dialogue writing examples
    this.exampleLibrary.set('dialogue-writing', [
      {
        id: 'dw-001',
        input: 'Character: Sarah (anxious, hiding something). Context: Confronted about missing money.',
        output: 'SARAH\n(avoiding eye contact)\nI... I don\'t know what you\'re talking about. The money was there when I left.\n\nHer fingers tear at the napkin in her lap.',
        description: 'Subtext through action and avoidance',
        category: 'dialogue-writing',
        qualityScore: 0.92,
      },
      {
        id: 'dw-002',
        input: 'Character: Mike (confident, lying). Context: Explaining his alibi.',
        output: 'MIKE\n(leaning back, easy smile)\nI was at O\'Malley\'s all night. Ask the bartender, ask anyone. I never left that stool.\n\nHe takes a slow sip of water. Doesn\'t blink.',
        description: 'Overconfidence as tell',
        category: 'dialogue-writing',
        qualityScore: 0.88,
      },
    ]);

    // Action writing examples
    this.exampleLibrary.set('action-writing', [
      {
        id: 'aw-001',
        input: 'A car chase through downtown. Protagonist driving.',
        output: 'The sedan screams around the corner, tires shrieking. Marcus fights the wheel, adrenaline sharp as glass. Through the windshield: a fruit cart explodes in slow motion, oranges cascading like tracer rounds. He doesn\'t brake.',
        description: 'Visceral action with sensory details',
        category: 'action-writing',
        qualityScore: 0.93,
      },
    ]);

    // Pacing examples
    this.exampleLibrary.set('pacing-control', [
      {
        id: 'pc-001',
        input: 'Fast-paced action scene needed. Protagonist escaping collapsing building.',
        output: 'Debris falls. Run. Dust chokes. Left turn. Stairs. More debris. Faster. The exit yawns—three meters. Two. He dives.',
        description: 'Short sentences, fragments for urgency',
        category: 'pacing-control',
        qualityScore: 0.9,
      },
      {
        id: 'pc-002',
        input: 'Slow, contemplative moment. Character reflecting on loss.',
        output: 'The photo trembles in her fingers. Twenty years. Twenty years since the door clicked shut. The dust on the frame is thicker than the memories. She traces his jaw with a fingertip. Cold glass. Colder absence.',
        description: 'Longer sentences, sensory focus for reflection',
        category: 'pacing-control',
        qualityScore: 0.91,
      },
    ]);
  }

  override async execute(input: FewShotBuilderInput, context: SkillContext): Promise<SkillResult<FewShotBuilderOutput>> {
    const startTime = Date.now();
    const config = { 
      ...this.config, 
      ...input.config,
      maxExamples: input.config?.maxExamples ?? (this.config['maxExamples'] as number) ?? defaultConfig.maxExamples,
      minQualityScore: input.config?.minQualityScore ?? (this.config['minQualityScore'] as number) ?? defaultConfig.minQualityScore,
      enableDynamicSelection: input.config?.enableDynamicSelection ?? (this.config['enableDynamicSelection'] as boolean) ?? defaultConfig.enableDynamicSelection,
    } as FewShotBuilderConfig;
    
    try {
      // Get examples from library
      let availableExamples: FewShotExample[] = [];
      
      if (input.availableExamples && input.availableExamples.length > 0) {
        availableExamples = input.availableExamples;
      } else if (this.exampleLibrary.has(input.task)) {
        availableExamples = this.exampleLibrary.get(input.task)!;
      } else {
        // Collect from all categories if no specific match
        for (const examples of this.exampleLibrary.values()) {
          availableExamples.push(...examples);
        }
      }

      // Filter by category if specified
      if (config.categories && config.categories.length > 0) {
        availableExamples = availableExamples.filter(ex => 
          ex.category && config.categories!.includes(ex.category)
        );
      }

      // Filter by quality score
      availableExamples = availableExamples.filter(ex => 
        (ex.qualityScore ?? 1) >= (config.minQualityScore ?? defaultConfig.minQualityScore)
      );

      // Sort by quality score descending
      availableExamples.sort((a, b) => (b.qualityScore ?? 1) - (a.qualityScore ?? 1));

      // Select examples
      const selectedExamples = config.enableDynamicSelection 
        ? this.selectDynamicExamples(availableExamples, input, config)
        : availableExamples.slice(0, config.maxExamples);

      // Build prompt template
      const promptTemplate = this.buildPromptTemplate(config.template ?? defaultConfig.template ?? '', selectedExamples, input);

      return {
        success: true,
        data: {
          examples: selectedExamples,
          promptTemplate,
          selectedCount: selectedExamples.length,
          totalAvailable: availableExamples.length,
        },
        metadata: {
          skillName: this.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: {
          examples: [],
          promptTemplate: '',
          selectedCount: 0,
          totalAvailable: 0,
        },
        metadata: {
          skillName: this.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private selectDynamicExamples(
    examples: FewShotExample[], 
    input: FewShotBuilderInput, 
    config: FewShotBuilderConfig
  ): FewShotExample[] {
    // Simple dynamic selection: prioritize examples matching task keywords
    const taskKeywords = this.extractKeywords(input.task);
    const contextKeywords = input.context ? this.extractKeywords(input.context) : [];
    const allKeywords = [...taskKeywords, ...contextKeywords];

    const scored = examples.map(ex => {
      let score = ex.qualityScore ?? 0.5;
      const exText = `${ex.input} ${ex.output} ${ex.description ?? ''}`.toLowerCase();
      
      for (const keyword of allKeywords) {
        if (exText.includes(keyword.toLowerCase())) {
          score += 0.1;
        }
      }
      
      return { example: ex, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, config.maxExamples).map(s => s.example);
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production would use NLP
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 10);
  }

  private buildPromptTemplate(
    template: string, 
    examples: FewShotExample[], 
    input: FewShotBuilderInput
  ): string {
    let result = template;
    
    // Simple template replacement
    result = result.replace('{{input}}', input.task);
    result = result.replace('{{context}}', input.context ?? '');
    
    // Build examples section
    const examplesText = examples.map(ex => 
      `Example ${ex.id}:\nInput: ${ex.input}\nOutput: ${ex.output}`
    ).join('\n\n');
    
    result = result.replace('{{#each examples}}{{/each}}', examplesText);
    result = result.replace('{{examples}}', examplesText);
    
    return result;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  // Public method to add custom examples
  addExamples(category: string, examples: FewShotExample[]): void {
    const existing = this.exampleLibrary.get(category) ?? [];
    this.exampleLibrary.set(category, [...existing, ...examples]);
  }

  // Public method to get available categories
  getCategories(): string[] {
    return Array.from(this.exampleLibrary.keys());
  }
}

export type SkillFactory<T extends PromptingSkill = PromptingSkill> = (config?: Record<string, unknown>) => Promise<T>;

export const createFewShotBuilder: SkillFactory<FewShotBuilder> = 
  async (config) => {
    const skill = new FewShotBuilder();
    await skill.initialize(config);
    return skill;
  };

export const fewShotBuilderRegistration = {
  metadata: {
    name: 'FewShotBuilder',
    version: '1.0.0',
    description: 'Builds few-shot examples for prompt optimization',
    category: 'prompting' as const,
    dependencies: [],
    required: false,
    configSchema: z.object({
      maxExamples: z.number().int().positive().default(5),
      minQualityScore: z.number().min(0).max(1).default(0.7),
      enableDynamicSelection: z.boolean().default(true),
      categories: z.array(z.string()).optional(),
      template: z.string().optional(),
    }),
    defaultConfig: defaultConfig,
  },
  factory: createFewShotBuilder,
};