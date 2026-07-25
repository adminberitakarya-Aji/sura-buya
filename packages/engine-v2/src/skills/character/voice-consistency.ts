/**
 * Suro-Buya Engine v2 - Voice Consistency Skill
 * 
 * Ensures character dialogue remains consistent with established voice profiles.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CharacterSkill } from '../base.js';
import type { CharacterProfile, SceneGenerationInput } from '../../types.js';
import type { DialogueLine } from '../writing/dialogue-writer.js';

/**
 * Voice Consistency configuration
 */
export interface VoiceConsistencyConfig extends Record<string, unknown> {
  [key: string]: unknown;
  /** Strictness level: lenient, standard, strict */
  strictness: 'lenient' | 'standard' | 'strict';
  /** Check vocabulary usage */
  checkVocabulary: boolean;
  /** Check speech patterns */
  checkSpeechPatterns: boolean;
  /** Check tone consistency */
  checkTone: boolean;
  /** Check catchphrases */
  checkCatchphrases: boolean;
  /** Minimum vocabulary match threshold (0-1) */
  vocabularyThreshold: number;
}

/**
 * Voice analysis result for a character
 */
export interface VoiceAnalysis {
  /** Character ID */
  characterId: string;
  /** Overall consistency score (0-1) */
  consistencyScore: number;
  /** Vocabulary match score */
  vocabularyScore: number;
  /** Speech pattern match score */
  speechPatternScore: number;
  /** Tone consistency score */
  toneScore: number;
  /** Catchphrase usage score */
  catchphraseScore: number;
  /** Issues found */
  issues: VoiceIssue[];
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Voice consistency issue
 */
export interface VoiceIssue {
  /** Issue type */
  type: 'vocabulary-mismatch' | 'speech-pattern-deviation' | 'tone-shift' | 'missing-catchphrase' | 'ooc-dialogue';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Dialogue line index */
  lineIndex?: number;
  /** Expected value */
  expected?: string;
  /** Actual value */
  actual?: string;
  /** Description */
  description: string;
  /** Suggestion to fix */
  suggestion: string;
}

/**
 * Voice Consistency Skill
 * Validates character dialogue against established voice profiles
 */
export class VoiceConsistency extends CharacterSkill<SceneGenerationInput, VoiceAnalysis[]> {
  override name = 'VoiceConsistency';
  override version = '1.0.0';
  override description = 'Ensures character dialogue consistency with established voice profiles';
  override dependencies: string[] = ['DialogueWriter'];
  override required = false;
  
  override configSchema = z.object({
    strictness: z.enum(['lenient', 'standard', 'strict']).default('standard'),
    checkVocabulary: z.boolean().default(true),
    checkSpeechPatterns: z.boolean().default(true),
    checkTone: z.boolean().default(true),
    checkCatchphrases: z.boolean().default(true),
    vocabularyThreshold: z.number().min(0).max(1).default(0.3),
  });

  override defaultConfig: Record<string, unknown> = {
    strictness: 'standard',
    checkVocabulary: true,
    checkSpeechPatterns: true,
    checkTone: true,
    checkCatchphrases: true,
    vocabularyThreshold: 0.3,
  };

  protected override config: VoiceConsistencyConfig = {
    strictness: 'standard',
    checkVocabulary: true,
    checkSpeechPatterns: true,
    checkTone: true,
    checkCatchphrases: true,
    vocabularyThreshold: 0.3,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<VoiceAnalysis[]>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const analyses: VoiceAnalysis[] = [];

      for (const charId of input.characters) {
        const character = context.characterBibles[charId];
        if (!character || !character.voice) {
          analyses.push(this.createEmptyAnalysis(charId, 'No voice profile found'));
          continue;
        }

        // Get dialogue for this character from skill data
        const dialogue = this.getCharacterDialogue(charId, context);
        if (!dialogue || dialogue.length === 0) {
          analyses.push(this.createEmptyAnalysis(charId, 'No dialogue generated'));
          continue;
        }

        const analysis = this.analyzeVoiceConsistency(character, dialogue, cfg);
        analyses.push(analysis);
      }

      return {
        success: true,
        data: analyses,
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
        error: (error as Error).message,
        metadata: {
          skillName: this.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    }
  }

  /**
   * Create empty analysis for characters without dialogue
   */
  private createEmptyAnalysis(characterId: string, reason: string): VoiceAnalysis {
    return {
      characterId,
      consistencyScore: 0,
      vocabularyScore: 0,
      speechPatternScore: 0,
      toneScore: 0,
      catchphraseScore: 0,
      issues: [{
        type: 'ooc-dialogue',
        severity: 'low',
        description: reason,
        suggestion: 'Ensure dialogue is generated for this character',
      }],
      suggestions: [],
    };
  }

  /**
   * Get dialogue lines for a character from context skill data
   */
  private getCharacterDialogue(characterId: string, context: SkillContext): DialogueLine[] | undefined {
    const dialogueWriterResult = context.skillData['DialogueWriter'];
    if (!dialogueWriterResult || typeof dialogueWriterResult !== 'object') return undefined;
    
    const output = dialogueWriterResult as { dialogue?: DialogueLine[] };
    if (!output.dialogue) return undefined;
    
    return output.dialogue.filter(line => line.characterId === characterId);
  }

  /**
   * Analyze voice consistency for a character's dialogue
   */
  private analyzeVoiceConsistency(
    character: CharacterProfile,
    dialogue: DialogueLine[],
    cfg: VoiceConsistencyConfig
  ): VoiceAnalysis {
    const issues: VoiceIssue[] = [];
    const suggestions: string[] = [];

    // Analyze vocabulary usage
    let vocabularyScore = 1.0;
    if (cfg.checkVocabulary && (character.voice?.vocabulary?.length ?? 0) > 0) {
      vocabularyScore = this.checkVocabulary(character, dialogue, issues, cfg.vocabularyThreshold);
    }

    // Analyze speech patterns
    let speechPatternScore = 1.0;
    if (cfg.checkSpeechPatterns && (character.voice?.speechPatterns?.length ?? 0) > 0) {
      speechPatternScore = this.checkSpeechPatterns(character, dialogue, issues);
    }

    // Analyze tone consistency
    let toneScore = 1.0;
    if (cfg.checkTone && character.voice?.tone) {
      toneScore = this.checkTone(character, dialogue, issues);
    }

    // Analyze catchphrase usage
    let catchphraseScore = 1.0;
    if (cfg.checkCatchphrases && character.voice?.catchphrases && character.voice?.catchphrases.length > 0) {
      catchphraseScore = this.checkCatchphrases(character, dialogue, issues, suggestions);
    }

    // Calculate overall consistency score
    const weights = { vocabulary: 0.3, speechPattern: 0.3, tone: 0.25, catchphrase: 0.15 };
    const consistencyScore = 
      vocabularyScore * weights.vocabulary +
      speechPatternScore * weights.speechPattern +
      toneScore * weights.tone +
      catchphraseScore * weights.catchphrase;

    // Add general suggestions based on scores
    if (vocabularyScore < 0.5) suggestions.push('Increase usage of character-specific vocabulary');
    if (speechPatternScore < 0.5) suggestions.push('Apply character speech patterns more consistently');
    if (toneScore < 0.5) suggestions.push('Maintain consistent emotional tone');
    if (catchphraseScore < 0.5) suggestions.push('Incorporate character catchphrases naturally');

    return {
      characterId: character.id,
      consistencyScore,
      vocabularyScore,
      speechPatternScore,
      toneScore,
      catchphraseScore,
      issues,
      suggestions: [...new Set(suggestions)],
    };
  }

  /**
   * Check vocabulary usage in dialogue
   */
  private checkVocabulary(
    character: CharacterProfile,
    dialogue: DialogueLine[],
    issues: VoiceIssue[],
    threshold: number
  ): number {
    const vocab = character.voice?.vocabulary?.map(v => v.toLowerCase()) || [];
    if (vocab.length === 0) return 1.0;

    let totalWords = 0;
    let vocabMatches = 0;

    for (const line of dialogue) {
      const words = line.text.toLowerCase().split(/\s+/);
      totalWords += words.length;
      for (const word of words) {
        if (vocab.includes(word)) vocabMatches++;
      }
    }

    const matchRatio = totalWords > 0 ? vocabMatches / totalWords : 0;
    const score = Math.min(1.0, matchRatio / threshold);

    if (matchRatio < threshold) {
      issues.push({
        type: 'vocabulary-mismatch',
        severity: this.getSeverityFromScore(score),
        description: `Vocabulary match ratio (${(matchRatio * 100).toFixed(1)}%) below threshold (${(threshold * 100).toFixed(1)}%)`,
        suggestion: `Include more of ${character.name}'s signature vocabulary: ${vocab.slice(0, 5).join(', ')}`,
      });
    }

    return score;
  }

  /**
   * Check speech pattern adherence
   */
  private checkSpeechPatterns(
    character: CharacterProfile,
    dialogue: DialogueLine[],
    issues: VoiceIssue[]
  ): number {
    const patterns = character.voice?.speechPatterns || [];
    if (patterns.length === 0) return 1.0;

    let patternMatches = 0;
    const totalChecks = dialogue.length * patterns.length;

    for (const line of dialogue) {
      for (const pattern of patterns) {
        if (this.detectSpeechPattern(line.text, pattern)) {
          patternMatches++;
        }
      }
    }

    const score = totalChecks > 0 ? patternMatches / totalChecks : 1.0;

    if (score < 0.3) {
      issues.push({
        type: 'speech-pattern-deviation',
        severity: this.getSeverityFromScore(score),
        description: `Speech pattern adherence low (${(score * 100).toFixed(1)}%)`,
        suggestion: `Apply patterns: ${patterns.join(', ')}`,
      });
    }

    return score;
  }

  /**
   * Detect if a speech pattern is present in text
   */
  private detectSpeechPattern(text: string, pattern: string): boolean {
    const detectors: Record<string, (t: string) => boolean> = {
      'stutters': (t) => /\b\w-\w+\b/.test(t),
      'formal': (t) => !/\b(can't|won't|don't|isn't|aren't|wasn't|weren't)\b/i.test(t),
      'slang': (t) => /\b(yeah|nah|cool|ok|okay|gonna|wanna|gotta)\b/i.test(t),
      'philosophical': (t) => /(one might say|it could be argued|philosophically|in essence)/i.test(t),
      'terse': (t) => t.split(/[.!?]/).filter(s => s.trim()).length <= 2 && t.length < 100,
      'rambling': (t) => t.split(/[.!?]/).filter(s => s.trim()).length > 4 || t.length > 300,
    };

    return detectors[pattern] ? detectors[pattern](text) : false;
  }

  /**
   * Check tone consistency
   */
  private checkTone(
    character: CharacterProfile,
    dialogue: DialogueLine[],
    issues: VoiceIssue[]
  ): number {
    const expectedTone = character.voice?.tone?.toLowerCase();
    if (!expectedTone) return 1.0;

    let toneMatches = 0;
    for (const line of dialogue) {
      const lineTone = line.tone?.toLowerCase();
      if (lineTone && this.tonesMatch(expectedTone, lineTone)) {
        toneMatches++;
      }
    }

    const score = dialogue.length > 0 ? toneMatches / dialogue.length : 1.0;

    if (score < 0.5) {
      issues.push({
        type: 'tone-shift',
        severity: this.getSeverityFromScore(score),
        description: `Tone consistency low (${(score * 100).toFixed(1)}% match expected "${expectedTone}")`,
        suggestion: `Maintain "${expectedTone}" tone throughout dialogue`,
      });
    }

    return score;
  }

  /**
   * Check if two tones are compatible
   */
  private tonesMatch(expected: string, actual: string): boolean {
    const toneGroups: Record<string, string[]> = {
      calm: ['calm', 'neutral', 'composed', 'serene', 'measured'],
      urgent: ['urgent', 'frantic', 'desperate', 'immediate', 'pressing'],
      frustrated: ['frustrated', 'annoyed', 'irritated', 'exasperated', 'aggravated'],
      hopeful: ['hopeful', 'optimistic', 'encouraged', 'confident', 'positive'],
      angry: ['angry', 'furious', 'enraged', 'outraged', 'livid'],
      sad: ['sad', 'melancholy', 'sorrowful', 'grieving', 'dejected'],
      determined: ['determined', 'resolute', 'steadfast', 'unwavering', 'firm'],
      confused: ['confused', 'perplexed', 'bewildered', 'uncertain', 'puzzled'],
    };

    const expectedGroup = Object.entries(toneGroups).find(([_, tones]) => tones.includes(expected))?.[0];
    const actualGroup = Object.entries(toneGroups).find(([_, tones]) => tones.includes(actual))?.[0];
    
    return expectedGroup === actualGroup;
  }

  /**
   * Check catchphrase usage
   */
  private checkCatchphrases(
    character: CharacterProfile,
    dialogue: DialogueLine[],
    issues: VoiceIssue[],
    suggestions: string[]
  ): number {
    const catchphrases = character.voice?.catchphrases || [];
    if (catchphrases.length === 0) return 1.0;

    let catchphraseUsed = false;
    for (const line of dialogue) {
      for (const phrase of catchphrases) {
        if (line.text.includes(phrase)) {
          catchphraseUsed = true;
          break;
        }
      }
      if (catchphraseUsed) break;
    }

    const score = catchphraseUsed ? 1.0 : 0.5;

    if (!catchphraseUsed) {
      issues.push({
        type: 'missing-catchphrase',
        severity: 'low',
        description: `No catchphrase used from: ${catchphrases.join(', ')}`,
        suggestion: `Naturally incorporate one of: ${catchphrases.slice(0, 3).join(', ')}`,
      });
      suggestions.push(`Consider using "${catchphrases[0]}" in dialogue`);
    }

    return score;
  }

  /**
   * Convert score to severity
   */
  private getSeverityFromScore(score: number): 'low' | 'medium' | 'high' {
    if (score < 0.3) return 'high';
    if (score < 0.6) return 'medium';
    return 'low';
  }
}

/**
 * Factory for creating VoiceConsistency
 */
export async function createVoiceConsistency(
  config?: Partial<VoiceConsistencyConfig>
): Promise<VoiceConsistency> {
  const skill = new VoiceConsistency();
  await skill.initialize(config);
  return skill;
}