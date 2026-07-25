/**
 * Suro-Buya Engine v2 - Context Compressor Skill
 * 
 * Compresses context for efficient prompt token usage.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { PromptingSkill } from '../base.js';

export interface ContextCompressorConfig {
  maxTokens: number;
  preserveStructure: boolean;
  compressionStrategy: 'summarize' | 'extract-key' | 'hierarchical';
  minRelevanceScore: number;
}

export interface ContextCompressorInput {
  context: string;
  task: string;
  config?: Partial<ContextCompressorConfig>;
}

export interface ContextCompressorOutput {
  compressedContext: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  preservedSections: string[];
}

const defaultConfig: ContextCompressorConfig = {
  maxTokens: 2000,
  preserveStructure: true,
  compressionStrategy: 'hierarchical',
  minRelevanceScore: 0.5,
};

export class ContextCompressor extends PromptingSkill<ContextCompressorInput, ContextCompressorOutput> {
  override name = 'ContextCompressor';
  override version = '1.0.0';
  override description = 'Compresses context for efficient prompt token usage';
  override dependencies: string[] = [];
  override required = false;
  
  override configSchema = z.object({
    maxTokens: z.number().int().positive().default(2000),
    preserveStructure: z.boolean().default(true),
    compressionStrategy: z.enum(['summarize', 'extract-key', 'hierarchical']).default('hierarchical'),
    minRelevanceScore: z.number().min(0).max(1).default(0.5),
  });

  override defaultConfig: Record<string, unknown> = {
    maxTokens: 2000,
    preserveStructure: true,
    compressionStrategy: 'hierarchical',
    minRelevanceScore: 0.5,
  };

  protected override config: Record<string, unknown> = { ...defaultConfig };

  override async initialize(config?: Record<string, unknown>): Promise<void> {
    await super.initialize(config);
    this.config = { ...defaultConfig, ...config };
  }

  override async execute(input: ContextCompressorInput, context: SkillContext): Promise<SkillResult<ContextCompressorOutput>> {
    const startTime = Date.now();
    const config = { ...this.config, ...input.config } as ContextCompressorConfig;
    
    try {
      const originalTokens = this.estimateTokens(input.context);
      
      // If already under limit, return as-is
      if (originalTokens <= config.maxTokens) {
        return {
          success: true,
          data: {
            compressedContext: input.context,
            originalTokens,
            compressedTokens: originalTokens,
            compressionRatio: 1.0,
            preservedSections: [input.context],
          },
          metadata: {
            skillName: this.name,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            skipped: false,
          },
        };
      }

      let compressedContext: string;
      
      switch (config.compressionStrategy) {
        case 'summarize':
          compressedContext = await this.summarizeContext(input.context, input.task, config);
          break;
        case 'extract-key':
          compressedContext = await this.extractKeyInformation(input.context, input.task, config);
          break;
        case 'hierarchical':
          compressedContext = await this.hierarchicalCompress(input.context, input.task, config);
          break;
      }

      const compressedTokens = this.estimateTokens(compressedContext);
      const compressionRatio = compressedTokens / originalTokens;

      return {
        success: true,
        data: {
          compressedContext,
          originalTokens,
          compressedTokens,
          compressionRatio,
          preservedSections: this.extractSections(compressedContext),
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
          compressedContext: '',
          originalTokens: 0,
          compressedTokens: 0,
          compressionRatio: 0,
          preservedSections: [],
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

  private async summarizeContext(context: string, task: string, config: ContextCompressorConfig): Promise<string> {
    // Simple summarization: keep first and last paragraphs, summarize middle
    const paragraphs = context.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length <= 3) {
      return context;
    }

    const keepCount = Math.max(2, Math.floor(paragraphs.length * 0.3));
    const first = paragraphs.slice(0, keepCount);
    const last = paragraphs.slice(-keepCount);
    const middle = paragraphs.slice(keepCount, -keepCount);
    
    // Create summary of middle section
    const middleSummary = middle.length > 0 
      ? `\n\n[Summary of ${middle.length} sections: ${this.extractKeywords(middle.join(' ')).slice(0, 5).join(', ')}...]\n\n`
      : '';

    return [...first, middleSummary, ...last].join('\n\n');
  }

  private async extractKeyInformation(context: string, task: string, config: ContextCompressorConfig): Promise<string> {
    // Extract sentences most relevant to the task
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const taskKeywords = this.extractKeywords(task.toLowerCase());
    
    const scored = sentences.map(sentence => {
      const words = sentence.toLowerCase().split(/\s+/);
      let score = 0;
      for (const keyword of taskKeywords) {
        if (words.includes(keyword)) score += 1;
      }
      return { sentence: sentence.trim(), score };
    });

    scored.sort((a, b) => b.score - a.score);
    
    const topSentences = scored
      .filter(s => s.score >= config.minRelevanceScore)
      .slice(0, Math.floor(config.maxTokens / 50))
      .map(s => s.sentence);

    return topSentences.join('. ') + '.';
  }

  private async hierarchicalCompress(context: string, task: string, config: ContextCompressorConfig): Promise<string> {
    // Multi-level compression: preserve structure, compress content
    const sections = this.parseSections(context);
    const taskKeywords = this.extractKeywords(task.toLowerCase());
    
    const compressedSections = sections.map(section => {
      if (this.isRelevant(section.content, taskKeywords, config.minRelevanceScore)) {
        // Keep relevant sections, compress if too long
        const tokens = this.estimateTokens(section.content);
        if (tokens > 500) {
          return {
            ...section,
            content: this.summarizeText(section.content, 500),
          };
        }
        return section;
      }
      // Irrelevant sections: just keep header
      return {
        ...section,
        content: '[Content compressed - low relevance to task]',
      };
    });

    // If still too long, apply progressive compression
    let result = this.formatSections(compressedSections);
    let tokens = this.estimateTokens(result);
    
    let level = 0;
    while (tokens > config.maxTokens && level < 3) {
      const compressionRatio = config.maxTokens / tokens;
      result = this.progressiveCompress(result, compressionRatio);
      tokens = this.estimateTokens(result);
      level++;
    }

    return result;
  }

  private parseSections(text: string): Array<{ header: string; content: string; level: number }> {
    const sections: Array<{ header: string; content: string; level: number }> = [];
    const lines = text.split('\n');
    let currentHeader = '';
    let currentContent = '';
    let currentLevel = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch && headerMatch[1] && headerMatch[2]) {
        if (currentHeader || currentContent) {
          sections.push({ header: currentHeader, content: currentContent.trim(), level: currentLevel });
        }
        currentLevel = headerMatch[1].length;
        currentHeader = headerMatch[2];
        currentContent = '';
      } else {
        currentContent += line + '\n';
      }
    }
    
    if (currentHeader || currentContent) {
      sections.push({ header: currentHeader, content: currentContent.trim(), level: currentLevel });
    }

    return sections.length > 0 ? sections : [{ header: '', content: text, level: 0 }];
  }

  private formatSections(sections: Array<{ header: string; content: string; level: number }>): string {
    return sections.map(s => {
      const header = s.header ? `${'#'.repeat(s.level)} ${s.header}` : '';
      return header ? `${header}\n${s.content}` : s.content;
    }).join('\n\n');
  }

  private isRelevant(content: string, keywords: string[], threshold: number): boolean {
    const words = content.toLowerCase().split(/\s+/);
    let matches = 0;
    for (const keyword of keywords) {
      if (words.includes(keyword)) matches++;
    }
    return matches / Math.max(keywords.length, 1) >= threshold;
  }

  private summarizeText(text: string, maxTokens: number): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const targetSentences = Math.max(2, Math.floor(maxTokens / 30));
    
    if (sentences.length <= targetSentences) return text;
    
    return sentences.slice(0, targetSentences).join('. ') + '. [Content summarized]';
  }

  private progressiveCompress(text: string, ratio: number): string {
    const words = text.split(/\s+/);
    const targetLength = Math.floor(words.length * ratio);
    return words.slice(0, targetLength).join(' ') + ' [...compressed]';
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 20);
  }

  private extractSections(text: string): string[] {
    return text.split('\n\n').filter(s => s.trim().length > 0);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export type SkillFactory<T extends PromptingSkill = PromptingSkill> = (config?: Record<string, unknown>) => Promise<T>;

export const createContextCompressor: SkillFactory<ContextCompressor> = 
  async (config) => {
    const skill = new ContextCompressor();
    await skill.initialize(config);
    return skill;
  };

export const contextCompressorRegistration = {
  metadata: {
    name: 'ContextCompressor',
    version: '1.0.0',
    description: 'Compresses context for efficient prompt token usage',
    category: 'prompting' as const,
    dependencies: [],
    required: false,
    configSchema: z.object({
      maxTokens: z.number().int().positive().default(2000),
      preserveStructure: z.boolean().default(true),
      compressionStrategy: z.enum(['summarize', 'extract-key', 'hierarchical']).default('hierarchical'),
      minRelevanceScore: z.number().min(0).max(1).default(0.5),
    }),
    defaultConfig: defaultConfig,
  },
  factory: createContextCompressor,
};