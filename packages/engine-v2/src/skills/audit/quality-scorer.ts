/**
 * Suro-Buya Engine v2 - Quality Scorer Skill
 * 
 * Scores generated content quality across multiple dimensions.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { ValidationSkill } from '../base.js';

/**
 * Quality score breakdown
 */
export interface QualityScore {
  /** Overall quality score (0-1) */
  overall: number;
  
  /** Individual dimension scores */
  dimensions: {
    /** Narrative coherence and flow */
    coherence: number;
    /** Character voice consistency */
    characterVoice: number;
    /** Dialogue naturalness */
    dialogueQuality: number;
    /** Action clarity and pacing */
    actionClarity: number;
    /** Setting/atmosphere vividness */
    atmosphere: number;
    /** Technical format compliance */
    formatCompliance: number;
    /** Originality/creativity */
    creativity: number;
    /** Emotional impact */
    emotionalImpact: number;
  };
  
  /** Detailed feedback per dimension */
  feedback: Record<string, {
    score: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }>;
  
  /** Pass/fail threshold */
  passed: boolean;
}

/**
 * Configuration for QualityScorer
 */
export const QualityScorerConfigSchema = z.object({
  weights: z.object({
    coherence: z.number().default(0.20),
    characterVoice: z.number().default(0.15),
    dialogueQuality: z.number().default(0.15),
    actionClarity: z.number().default(0.10),
    atmosphere: z.number().default(0.10),
    formatCompliance: z.number().default(0.15),
    creativity: z.number().default(0.10),
    emotionalImpact: z.number().default(0.05),
  }).default({}),
  passingThreshold: z.number().min(0).max(1).default(0.7),
  enableDetailedFeedback: z.boolean().default(true),
  minContentLength: z.number().default(100),
});

export type QualityScorerConfig = z.infer<typeof QualityScorerConfigSchema>;

/**
 * QualityScorer Skill - Scores content quality across multiple dimensions
 */
export class QualityScorer extends ValidationSkill<string, QualityScore> {
  override name = 'QualityScorer';
  override version = '1.0.0';
  override description = 'Scores generated content quality across multiple dimensions';
  override category = 'audit' as const;
  override dependencies = ['FormatChecker'];
  override required = true;
  override configSchema = QualityScorerConfigSchema;
  override defaultConfig: QualityScorerConfig = {
    weights: {
      coherence: 0.20,
      characterVoice: 0.15,
      dialogueQuality: 0.15,
      actionClarity: 0.10,
      atmosphere: 0.10,
      formatCompliance: 0.15,
      creativity: 0.10,
      emotionalImpact: 0.05,
    },
    passingThreshold: 0.7,
    enableDetailedFeedback: true,
    minContentLength: 100,
  };

  protected override config: QualityScorerConfig = this.defaultConfig;

  override async initialize(config?: Record<string, unknown>): Promise<void> {
    this.config = { ...this.defaultConfig, ...config } as QualityScorerConfig;
    const result = this.configSchema.safeParse(this.config);
    if (!result.success) {
      throw new Error(`Invalid config for ${this.name}: ${result.error.message}`);
    }
  }

  async validate(input: string, context: SkillContext): Promise<SkillResult<QualityScore>> {
    if (input.length < this.config.minContentLength) {
      return {
        success: false,
        error: `Content too short (${input.length} chars) for quality scoring. Minimum: ${this.config.minContentLength}`,
        metadata: {
          skillName: this.name,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    }

    try {
      const dimensions = await this.scoreDimensions(input, context);
      const overall = this.calculateOverall(dimensions);
      const passed = overall >= this.config.passingThreshold;

      const feedback = this.config.enableDetailedFeedback 
        ? this.generateFeedback(input, dimensions, context)
        : {};

      const result: QualityScore = {
        overall,
        dimensions,
        feedback,
        passed,
      };

      return {
        success: true,
        data: result,
        metadata: {
          skillName: this.name,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
        warnings: passed ? [] : [`Quality score ${overall.toFixed(2)} below threshold ${this.config.passingThreshold}`],
      };
    } catch (error) {
      return {
        success: false,
        error: `Quality scoring failed: ${(error as Error).message}`,
        metadata: {
          skillName: this.name,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    }
  }

  override async execute(input: string, context: SkillContext): Promise<SkillResult<QualityScore>> {
    return this.validate(input, context);
  }

  /**
   * Score all quality dimensions
   */
  private async scoreDimensions(input: string, context: SkillContext): Promise<QualityScore['dimensions']> {
    return {
      coherence: this.scoreCoherence(input),
      characterVoice: this.scoreCharacterVoice(input, context),
      dialogueQuality: this.scoreDialogueQuality(input),
      actionClarity: this.scoreActionClarity(input),
      atmosphere: this.scoreAtmosphere(input),
      formatCompliance: this.scoreFormatCompliance(input),
      creativity: this.scoreCreativity(input),
      emotionalImpact: this.scoreEmotionalImpact(input),
    };
  }

  /**
   * Score narrative coherence
   */
  private scoreCoherence(input: string): number {
    let score = 0.5; // Base score
    
    // Check for transitional phrases
    const transitions = [
      'meanwhile', 'later', 'suddenly', 'then', 'after', 'before',
      'as', 'while', 'when', 'because', 'since', 'therefore',
      'however', 'but', 'yet', 'still', 'nevertheless'
    ];
    const transitionCount = transitions.filter(t => input.toLowerCase().includes(t)).length;
    score += Math.min(0.2, transitionCount * 0.03);

    // Check paragraph structure
    const paragraphs = input.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 3) score += 0.1;
    if (paragraphs.length >= 5) score += 0.1;

    // Check sentence variety
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    if (avgLength > 50 && avgLength < 200) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * Score character voice consistency
   */
  private scoreCharacterVoice(input: string, context: SkillContext): number {
    if (!context.characterBibles || Object.keys(context.characterBibles).length === 0) {
      return 0.5; // Neutral if no character bibles
    }

    let score = 0.5;
    const contentLower = input.toLowerCase();

    for (const [charId, bible] of Object.entries(context.characterBibles)) {
      const charName = bible.name.toLowerCase();
      
      // Check if character appears
      if (!contentLower.includes(charName)) continue;

      // Check for speech patterns
      if (bible.voice?.speechPatterns) {
        let patternMatches = 0;
        for (const pattern of bible.voice.speechPatterns) {
          try {
            if (new RegExp(pattern, 'i').test(input)) patternMatches++;
          } catch {
            // Invalid regex, skip
          }
        }
        if (patternMatches > 0) score += Math.min(0.2, patternMatches * 0.05);
      }

      // Check vocabulary usage
      if (bible.voice?.vocabulary) {
        const vocabMatches = bible.voice.vocabulary.filter(v => 
          contentLower.includes(v.toLowerCase())
        ).length;
        if (vocabMatches > 0) score += Math.min(0.15, vocabMatches * 0.03);
      }

      // Check catchphrases
      if (bible.voice?.catchphrases) {
        const catchphraseMatches = bible.voice.catchphrases.filter(cp =>
          contentLower.includes(cp.toLowerCase())
        ).length;
        if (catchphraseMatches > 0) score += Math.min(0.1, catchphraseMatches * 0.05);
      }
    }

    return Math.min(1, score);
  }

  /**
   * Score dialogue quality
   */
  private scoreDialogueQuality(input: string): number {
    let score = 0.3; // Base score
    
    // Count dialogue lines (simple heuristic: lines with quotes)
    const dialogueLines = input.match(/["'][^"']+["']/g) || [];
    if (dialogueLines.length > 0) score += 0.2;
    if (dialogueLines.length > 3) score += 0.15;
    if (dialogueLines.length > 8) score += 0.1;

    // Check for dialogue tags
    const dialogueTags = input.match(/(said|asked|replied|whispered|shouted|murmured|stated|declared|exclaimed)/gi) || [];
    if (dialogueTags.length > 0) score += Math.min(0.15, dialogueTags.length * 0.02);

    // Check for action beats in dialogue
    const actionBeats = input.match(/[.!?]\s+[A-Z][a-z]+\s+(looked|turned|smiled|nodded|shook|paused|hesitated)/gi) || [];
    if (actionBeats.length > 0) score += Math.min(0.15, actionBeats.length * 0.03);

    // Check for subtext (indirect dialogue)
    const subtextIndicators = ['implied', 'suggested', 'hinted', 'meant', 'understood'];
    const subtextCount = subtextIndicators.filter(w => input.toLowerCase().includes(w)).length;
    if (subtextCount > 0) score += Math.min(0.1, subtextCount * 0.03);

    return Math.min(1, score);
  }

  /**
   * Score action clarity
   */
  private scoreActionClarity(input: string): number {
    let score = 0.4; // Base score
    
    // Check for strong verbs
    const strongVerbs = [
      'sprinted', 'lunged', 'grabbed', 'shoved', 'crashed', 'smashed',
      'darted', 'bolted', 'charged', 'struck', 'blocked', 'parried',
      'dodged', 'rolled', 'leaped', 'climbed', 'shattered', 'exploded'
    ];
    const strongVerbCount = strongVerbs.filter(v => input.toLowerCase().includes(v)).length;
    score += Math.min(0.25, strongVerbCount * 0.03);

    // Check for sensory details
    const sensoryWords = [
      'heard', 'saw', 'felt', 'smelled', 'tasted', 'sound', 'noise',
      'scent', 'aroma', 'texture', 'cold', 'hot', 'rough', 'smooth',
      'bright', 'dark', 'loud', 'quiet', 'silent', 'deafening'
    ];
    const sensoryCount = sensoryWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.2, sensoryCount * 0.02);

    // Check for clear spatial orientation
    const spatialWords = ['left', 'right', 'behind', 'ahead', 'above', 'below', 'near', 'far', 'between', 'beside'];
    const spatialCount = spatialWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.15, spatialCount * 0.02);

    return Math.min(1, score);
  }

  /**
   * Score atmosphere/setting vividness
   */
  private scoreAtmosphere(input: string): number {
    let score = 0.3; // Base score
    
    // Check for atmospheric descriptors
    const atmosphereWords = [
      'atmosphere', 'mood', 'ambience', 'tone', 'feeling', 'vibe',
      'ominous', 'tense', 'peaceful', 'chaotic', 'serene', 'gloomy',
      'bright', 'shadowy', 'misty', 'foggy', 'humid', 'crisp',
      'silence', 'stillness', 'tension', 'anticipation', 'dread', 'hope'
    ];
    const atmosphereCount = atmosphereWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.3, atmosphereCount * 0.03);

    // Check for weather/environmental details
    const weatherWords = ['rain', 'snow', 'wind', 'storm', 'sun', 'cloud', 'fog', 'mist', 'thunder', 'lightning'];
    const weatherCount = weatherWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.2, weatherCount * 0.04);

    // Check for time of day indicators
    const timeWords = ['dawn', 'dusk', 'midnight', 'noon', 'morning', 'evening', 'night', 'twilight', 'sunrise', 'sunset'];
    const timeCount = timeWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.15, timeCount * 0.05);

    // Check for lighting descriptions
    const lightWords = ['light', 'shadow', 'dark', 'bright', 'dim', 'glow', 'shine', 'reflect', 'illuminate'];
    const lightCount = lightWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.15, lightCount * 0.02);

    return Math.min(1, score);
  }

  /**
   * Score format compliance (screenplay format)
   */
  private scoreFormatCompliance(input: string): number {
    let score = 0.3; // Base score
    
    // Check for scene headings (INT./EXT.)
    const sceneHeadings = input.match(/^(INT\.|EXT\.|INT\/EXT\.)\s+.+$/gm) || [];
    if (sceneHeadings.length > 0) score += 0.25;
    if (sceneHeadings.length > 2) score += 0.1;

    // Check for character names (caps before dialogue)
    const charNames = input.match(/^[A-Z][A-Z\s]{2,}\s*$/gm) || [];
    if (charNames.length > 0) score += 0.2;
    if (charNames.length > 3) score += 0.1;

    // Check for parentheticals
    const parentheticals = input.match(/\([^)]+\)/g) || [];
    if (parentheticals.length > 0) score += 0.1;

    // Check for transitions
    const transitions = input.match(/^(CUT TO|FADE TO|DISSOLVE TO|SMASH CUT TO)/gim) || [];
    if (transitions.length > 0) score += 0.1;

    // Check for action lines (not dialogue, not scene heading)
    const lines = input.split('\n');
    const actionLines = lines.filter(l => 
      l.trim().length > 0 && 
      !l.match(/^(INT\.|EXT\.|INT\/EXT\.)/) &&
      !l.match(/^[A-Z][A-Z\s]{2,}\s*$/) &&
      !l.match(/^\(/) &&
      !l.match(/^(CUT TO|FADE TO)/i)
    ).length;
    if (actionLines > 0) score += 0.15;

    return Math.min(1, score);
  }

  /**
   * Score creativity/originality
   */
  private scoreCreativity(input: string): number {
    let score = 0.4; // Base score
    
    // Check for unique metaphors/similes
    const metaphors = input.match(/\b(like|as)\s+\w+\s+(as|like)\s+\w+/gi) || [];
    score += Math.min(0.2, metaphors.length * 0.04);

    // Check for unexpected word combinations (simple heuristic)
    const words = input.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const uniqueWords = new Set(words);
    const diversity = uniqueWords.size / words.length;
    score += Math.min(0.2, diversity * 0.3);

    // Check for specific/descriptive language vs generic
    const genericWords = ['good', 'bad', 'nice', 'great', 'awesome', 'terrible', 'happy', 'sad', 'angry'];
    const specificCount = words.filter(w => !genericWords.includes(w)).length;
    if (words.length > 0) {
      score += Math.min(0.2, (specificCount / words.length) * 0.3);
    }

    return Math.min(1, score);
  }

  /**
   * Score emotional impact
   */
  private scoreEmotionalImpact(input: string): number {
    let score = 0.3; // Base score
    
    // Check for emotional vocabulary
    const emotionalWords = [
      'heart', 'soul', 'tears', 'laughter', 'joy', 'sorrow', 'grief', 'pain',
      'love', 'hate', 'fear', 'hope', 'despair', 'rage', 'peace', 'longing',
      'yearning', 'ache', 'throb', 'pound', 'race', 'shatter', 'break', 'mend'
    ];
    const emotionalCount = emotionalWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.3, emotionalCount * 0.03);

    // Check for internal states
    const internalWords = ['thought', 'felt', 'realized', 'remembered', 'wondered', 'feared', 'hoped', 'dreamed'];
    const internalCount = internalWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.2, internalCount * 0.04);

    // Check for stakes/consequences
    const stakeWords = ['lose', 'lose', 'risk', 'stake', 'cost', 'price', 'sacrifice', 'choice', 'decide', 'must'];
    const stakeCount = stakeWords.filter(w => input.toLowerCase().includes(w)).length;
    score += Math.min(0.2, stakeCount * 0.04);

    return Math.min(1, score);
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverall(dimensions: QualityScore['dimensions']): number {
    const weights = this.config.weights;
    let total = 0;
    let weightSum = 0;

    for (const [dimension, score] of Object.entries(dimensions)) {
      const weight = weights[dimension as keyof typeof weights] || 0;
      total += score * weight;
      weightSum += weight;
    }

    return weightSum > 0 ? total / weightSum : 0;
  }

  /**
   * Generate detailed feedback
   */
  private generateFeedback(
    input: string, 
    dimensions: QualityScore['dimensions'], 
    context: SkillContext
  ): QualityScore['feedback'] {
    const feedback: QualityScore['feedback'] = {};

    for (const [dimension, score] of Object.entries(dimensions)) {
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const suggestions: string[] = [];

      if (score >= 0.8) {
        strengths.push(`Strong ${dimension} (${(score * 100).toFixed(0)}%)`);
      } else if (score >= 0.6) {
        strengths.push(`Adequate ${dimension} (${(score * 100).toFixed(0)}%)`);
      } else {
        weaknesses.push(`Weak ${dimension} (${(score * 100).toFixed(0)}%)`);
      }

      // Dimension-specific feedback
      switch (dimension) {
        case 'coherence':
          if (score < 0.7) {
            suggestions.push('Add more transitional phrases between scenes/paragraphs');
            suggestions.push('Ensure clear cause-effect relationships in narrative');
          }
          break;
        case 'characterVoice':
          if (score < 0.7 && context.characterBibles) {
            suggestions.push('Incorporate character-specific speech patterns and vocabulary');
            suggestions.push('Use character catchphrases and verbal tics consistently');
          }
          break;
        case 'dialogueQuality':
          if (score < 0.7) {
            suggestions.push('Add more dialogue tags and action beats');
            suggestions.push('Include subtext and indirect dialogue');
          }
          break;
        case 'actionClarity':
          if (score < 0.7) {
            suggestions.push('Use stronger, more specific verbs');
            suggestions.push('Add sensory details and spatial orientation');
          }
          break;
        case 'atmosphere':
          if (score < 0.7) {
            suggestions.push('Describe lighting, weather, and ambient sounds');
            suggestions.push('Establish mood through environmental details');
          }
          break;
        case 'formatCompliance':
          if (score < 0.7) {
            suggestions.push('Ensure proper screenplay format (scene headings, character names, dialogue)');
            suggestions.push('Use standard transitions and parentheticals');
          }
          break;
        case 'creativity':
          if (score < 0.7) {
            suggestions.push('Use more specific, evocative language');
            suggestions.push('Incorporate fresh metaphors and unexpected descriptions');
          }
          break;
        case 'emotionalImpact':
          if (score < 0.7) {
            suggestions.push('Show internal emotional states');
            suggestions.push('Raise stakes and consequences for characters');
          }
          break;
      }

      feedback[dimension] = { score, strengths, weaknesses, suggestions };
    }

    return feedback;
  }
}

/**
 * Factory function for QualityScorer
 */
export async function createQualityScorer(config?: Record<string, unknown>): Promise<QualityScorer> {
  const scorer = new QualityScorer();
  await scorer.initialize(config);
  return scorer;
}
