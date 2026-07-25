/**
 * Suro-Buya Engine v2 - Prompt Optimizer Skill
 * 
 * Optimizes prompts for better LLM responses.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { PromptingSkill } from '../base.js';

export interface PromptOptimizerConfig extends Record<string, unknown> {
  enableFewShot: boolean;
  enableChainOfThought: boolean;
  enableStructuredOutput: boolean;
  maxTokens: number;
  temperature: number;
  optimizationLevel: 'light' | 'medium' | 'aggressive';
}

export interface PromptOptimizerInput {
  task: string;
  basePrompt: string;
  context?: string;
  examples?: Array<{ input: string; output: string }>;
  config?: Partial<PromptOptimizerConfig>;
}

export interface PromptOptimizerOutput {
  optimizedPrompt: string;
  techniquesApplied: string[];
  estimatedTokens: number;
  improvements: string[];
}

const defaultConfig: PromptOptimizerConfig = {
  enableFewShot: true,
  enableChainOfThought: true,
  enableStructuredOutput: true,
  maxTokens: 4000,
  temperature: 0.7,
  optimizationLevel: 'medium',
};

export class PromptOptimizer extends PromptingSkill<PromptOptimizerInput, PromptOptimizerOutput> {
  override name = 'PromptOptimizer';
  override version = '1.0.0';
  override description = 'Optimizes prompts for better LLM responses';
  override dependencies: string[] = [];
  override required = false;
  
  override configSchema = z.object({
    enableFewShot: z.boolean().default(true),
    enableChainOfThought: z.boolean().default(true),
    enableStructuredOutput: z.boolean().default(true),
    maxTokens: z.number().positive().default(4000),
    temperature: z.number().min(0).max(2).default(0.7),
    optimizationLevel: z.enum(['light', 'medium', 'aggressive']).default('medium'),
  });

  override defaultConfig: Record<string, unknown> = {
    enableFewShot: true,
    enableChainOfThought: true,
    enableStructuredOutput: true,
    maxTokens: 4000,
    temperature: 0.7,
    optimizationLevel: 'medium',
  };

  protected override config: Record<string, unknown> = { ...defaultConfig };

  override async initialize(config?: Record<string, unknown>): Promise<void> {
    await super.initialize(config);
    this.config = { ...defaultConfig, ...config };
  }

  override async execute(input: PromptOptimizerInput, context: SkillContext): Promise<SkillResult<PromptOptimizerOutput>> {
    const startTime = Date.now();
    const config = { ...this.config, ...input.config } as PromptOptimizerConfig;
    
    try {
      let optimizedPrompt = input.basePrompt;
      const techniquesApplied: string[] = [];
      const improvements: string[] = [];

      // Apply Chain of Thought
      if (config.enableChainOfThought) {
        optimizedPrompt = this.addChainOfThought(optimizedPrompt);
        techniquesApplied.push('chain-of-thought');
        improvements.push('Added step-by-step reasoning instruction');
      }

      // Apply Few-Shot
      if (config.enableFewShot && input.examples && input.examples.length > 0) {
        optimizedPrompt = this.addFewShotExamples(optimizedPrompt, input.examples);
        techniquesApplied.push('few-shot');
        improvements.push(`Added ${input.examples.length} few-shot examples`);
      }

      // Apply Structured Output
      if (config.enableStructuredOutput) {
        optimizedPrompt = this.addStructuredOutputFormat(optimizedPrompt);
        techniquesApplied.push('structured-output');
        improvements.push('Added structured output formatting');
      }

      // Apply context if provided
      if (input.context) {
        optimizedPrompt = this.addContext(optimizedPrompt, input.context);
        improvements.push('Added contextual information');
      }

      // Add task-specific instructions based on optimization level
      if (config.optimizationLevel !== 'light') {
        optimizedPrompt = this.addOptimizationInstructions(optimizedPrompt, config.optimizationLevel);
        techniquesApplied.push(`optimization-${config.optimizationLevel}`);
        improvements.push(`Applied ${config.optimizationLevel} optimization techniques`);
      }

      // Estimate tokens
      const estimatedTokens = this.estimateTokens(optimizedPrompt);

      return {
        success: true,
        data: {
          optimizedPrompt,
          techniquesApplied,
          estimatedTokens,
          improvements,
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
          optimizedPrompt: '',
          techniquesApplied: [],
          estimatedTokens: 0,
          improvements: [],
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

  private addChainOfThought(prompt: string): string {
    const cotInstruction = '\n\nThink through this step-by-step:\n1. Analyze the task requirements\n2. Identify key constraints and goals\n3. Plan your approach\n4. Execute the plan\n5. Review and refine';
    
    if (!prompt.includes('Think through') && !prompt.includes('step-by-step')) {
      return prompt + cotInstruction;
    }
    return prompt;
  }

  private addFewShotExamples(prompt: string, examples: Array<{ input: string; output: string }>): string {
    const examplesSection = '\n\nExamples:\n' + examples.map((ex, i) => 
      `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`
    ).join('\n\n') + '\n\nNow complete the task:\n';
    
    return prompt + examplesSection;
  }

  private addStructuredOutputFormat(prompt: string): string {
    const formatInstruction = '\n\nProvide your response in the following structured format:\n```json\n{\n  "output": "your response here",\n  "reasoning": "brief explanation of your approach",\n  "confidence": 0.95\n}\n```';
    
    if (!prompt.includes('structured format') && !prompt.includes('```json')) {
      return prompt + formatInstruction;
    }
    return prompt;
  }

  private addContext(prompt: string, context: string): string {
    return `Context:\n${context}\n\n---\n\n${prompt}`;
  }

  private addOptimizationInstructions(prompt: string, level: 'light' | 'medium' | 'aggressive'): string {
    const instructions = {
      light: '\n\nBe concise and accurate.',
      medium: '\n\nFocus on quality, clarity, and adherence to the task requirements. Use specific examples where helpful.',
      aggressive: '\n\nMaximize quality and precision. Use advanced techniques: show-don\'t-tell, subtext, sensory details, varied sentence structure, and strong verbs. Avoid clichés and generic descriptions.',
    };
    
    return prompt + instructions[level];
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export type SkillFactory<T extends PromptingSkill = PromptingSkill> = (config?: Record<string, unknown>) => Promise<T>;

export const createPromptOptimizer: SkillFactory<PromptOptimizer> = 
  async (config) => {
    const skill = new PromptOptimizer();
    await skill.initialize(config);
    return skill;
  };

export const promptOptimizerRegistration = {
  metadata: {
    name: 'PromptOptimizer',
    version: '1.0.0',
    description: 'Optimizes prompts for better LLM responses',
    category: 'prompting' as const,
    dependencies: [],
    required: false,
    configSchema: z.object({
      enableFewShot: z.boolean().default(true),
      enableChainOfThought: z.boolean().default(true),
      enableStructuredOutput: z.boolean().default(true),
      maxTokens: z.number().positive().default(4000),
      temperature: z.number().min(0).max(2).default(0.7),
      optimizationLevel: z.enum(['light', 'medium', 'aggressive']).default('medium'),
    }),
    defaultConfig: defaultConfig,
  },
  factory: createPromptOptimizer,
};