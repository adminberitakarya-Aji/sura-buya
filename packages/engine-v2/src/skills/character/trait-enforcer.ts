/**
 * Suro-Buya Engine v2 - Trait Enforcer Skill
 * 
 * Ensures character actions and dialogue align with defined personality traits.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CharacterSkill } from '../base.js';
import type { CharacterProfile, SceneGenerationInput } from '../../types.js';

/**
 * Trait Enforcer configuration
 */
export interface TraitEnforcerConfig extends Record<string, unknown> {
  [key: string]: unknown;
  /** Check trait consistency in actions */
  checkActions: boolean;
  /** Check trait consistency in dialogue */
  checkDialogue: boolean;
  /** Check trait consistency in decisions */
  checkDecisions: boolean;
  /** Minimum trait expression per scene */
  minTraitExpressions: number;
  /** Trait weight thresholds */
  traitThresholds: Record<string, number>;
}

/**
 * Trait expression in a scene
 */
export interface TraitExpression {
  /** Trait name */
  trait: string;
  /** Expression type */
  type: 'action' | 'dialogue' | 'decision' | 'reaction';
  /** Description of expression */
  description: string;
  /** Strength of expression (0-1) */
  strength: number;
  /** Beat where expressed */
  beatIndex: number;
}

/**
 * Trait enforcement analysis
 */
export interface TraitEnforcementAnalysis {
  /** Character ID */
  characterId: string;
  /** Trait expressions found */
  expressions: TraitExpression[];
  /** Missing trait expressions */
  missingTraits: string[];
  /** Trait consistency score */
  consistencyScore: number;
  /** Issues detected */
  issues: TraitIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Trait enforcement issue
 */
export interface TraitIssue {
  /** Issue type */
  type: 'trait-unexpressed' | 'trait-contradicted' | 'trait-overused' | 'trait-inconsistent';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Trait name */
  trait: string;
  /** Beat index */
  beatIndex?: number;
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Trait Enforcer Skill
 * Ensures character traits are consistently expressed
 */
export class TraitEnforcer extends CharacterSkill<SceneGenerationInput, TraitEnforcementAnalysis[]> {
  override name = 'TraitEnforcer';
  override version = '1.0.0';
  override description = 'Ensures character actions and dialogue align with defined personality traits';
  override dependencies: string[] = ['VoiceConsistency', 'ArcProgression', 'RelationshipMapper'];
  override required = false;
  
  override configSchema = z.object({
    checkActions: z.boolean().default(true),
    checkDialogue: z.boolean().default(true),
    checkDecisions: z.boolean().default(true),
    minTraitExpressions: z.number().default(2),
    traitThresholds: z.record(z.number()).default({}),
  });

  override defaultConfig: Record<string, unknown> = {
    checkActions: true,
    checkDialogue: true,
    checkDecisions: true,
    minTraitExpressions: 2,
    traitThresholds: {},
  };

  protected override config: TraitEnforcerConfig = {
    checkActions: true,
    checkDialogue: true,
    checkDecisions: true,
    minTraitExpressions: 2,
    traitThresholds: {},
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<TraitEnforcementAnalysis[]>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const analyses: TraitEnforcementAnalysis[] = [];

      for (const charId of input.characters) {
        const character = context.characterBibles[charId];
        if (!character) {
          analyses.push(this.createEmptyAnalysis(charId, 'Character not found'));
          continue;
        }

        const analysis = this.analyzeTraitEnforcement(character, input, context, cfg);
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
   * Create empty analysis
   */
  private createEmptyAnalysis(characterId: string, reason: string): TraitEnforcementAnalysis {
    return {
      characterId,
      expressions: [],
      missingTraits: [],
      consistencyScore: 0,
      issues: [{
        type: 'trait-unexpressed',
        severity: 'low',
        trait: 'all',
        description: reason,
        suggestion: 'Ensure character is in bible with traits',
      }],
      recommendations: [],
    };
  }

  /**
   * Analyze trait enforcement for a character
   */
  private analyzeTraitEnforcement(
    character: CharacterProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    cfg: TraitEnforcerConfig
  ): TraitEnforcementAnalysis {
    const issues: TraitIssue[] = [];
    const recommendations: string[] = [];
    const expressions: TraitExpression[] = [];
    const expressedTraits = new Set<string>();

    const traits = character.traits || [];
    if (traits.length === 0) {
      return {
        characterId: character.id,
        expressions: [],
        missingTraits: [],
        consistencyScore: 1.0,
        issues: [],
        recommendations: ['Add traits to character profile'],
      };
    }

    // Analyze each beat for trait expressions
    for (let i = 0; i < input.keyBeats.length; i++) {
      const beat = input.keyBeats[i]!;
      const beatExpressions = this.findTraitExpressions(character, beat, i, cfg);
      expressions.push(...beatExpressions);
      beatExpressions.forEach(e => expressedTraits.add(e.trait));
    }

    // Check for unexpressed traits
    const threshold = cfg.minTraitExpressions;
    for (const trait of traits) {
      const traitExprs = expressions.filter(e => e.trait === trait);
      if (traitExprs.length < threshold) {
        const missingCount = threshold - traitExprs.length;
        issues.push({
          type: 'trait-unexpressed',
          severity: missingCount >= threshold ? 'high' : 'medium',
          trait,
          description: `Trait "${trait}" expressed ${traitExprs.length} times, minimum ${threshold}`,
          suggestion: `Include ${trait} in ${missingCount} more beat(s)`,
        });
        if (!expressedTraits.has(trait)) {
          recommendations.push(`Express "${trait}" trait in scene`);
        }
      }
    }

    // Check for contradictory expressions
    this.checkContradictions(character, expressions, issues);

    // Check for overused traits
    this.checkOveruse(expressions, traits, issues);

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(traits, expressions, issues);

    // Generate recommendations
    const unexpressed = traits.filter(t => !expressedTraits.has(t));
    if (unexpressed.length > 0) {
      recommendations.push(`Express missing traits: ${unexpressed.join(', ')}`);
    }
    if (issues.some(i => i.type === 'trait-contradicted')) {
      recommendations.push('Review contradictory trait expressions');
    }

    return {
      characterId: character.id,
      expressions,
      missingTraits: unexpressed,
      consistencyScore,
      issues,
      recommendations: [...new Set(recommendations)],
    };
  }

  /**
   * Find trait expressions in a beat
   */
  private findTraitExpressions(
    character: CharacterProfile,
    beat: string,
    beatIndex: number,
    cfg: TraitEnforcerConfig
  ): TraitExpression[] {
    const expressions: TraitExpression[] = [];
    const beatLower = beat.toLowerCase();
    const traits = character.traits || [];

    for (const trait of traits) {
      const traitLower = trait.toLowerCase();
      const keywords = this.getTraitKeywords(trait);
      
      for (const keyword of keywords) {
        if (beatLower.includes(keyword.toLowerCase())) {
          // Determine expression type
          let type: TraitExpression['type'] = 'action';
          if (beatLower.includes('say') || beatLower.includes('tell') || beatLower.includes('ask')) {
            type = 'dialogue';
          } else if (beatLower.includes('decide') || beatLower.includes('choose')) {
            type = 'decision';
          } else if (beatLower.includes('react') || beatLower.includes('respond')) {
            type = 'reaction';
          }

          expressions.push({
            trait,
            type,
            description: `${type}: ${beat}`,
            strength: this.calculateExpressionStrength(beat, keyword),
            beatIndex,
          });
          break; // One expression per trait per beat
        }
      }
    }

    return expressions;
  }

  /**
   * Get keywords associated with a trait
   */
  private getTraitKeywords(trait: string): string[] {
    const traitKeywords: Record<string, string[]> = {
      // Core traits
      'brave': ['brave', 'courage', 'fearless', 'bold', 'daring', 'heroic'],
      'cowardly': ['coward', 'fear', 'scared', 'terrified', 'run', 'hide', 'panic'],
      'intelligent': ['smart', 'clever', 'analyze', 'deduce', 'figure out', 'calculate', 'brilliant'],
      'naive': ['naive', 'innocent', 'trusting', 'gullible', "don't understand", 'oblivious'],
      'loyal': ['loyal', 'faithful', 'devoted', 'stand by', 'never leave', 'commitment'],
      'treacherous': ['betray', 'deceive', 'traitor', 'double-cross', 'scheme', 'plot'],
      'compassionate': ['compassion', 'empathy', 'care', 'help', 'kind', 'gentle', 'mercy'],
      'ruthless': ['ruthless', 'merciless', 'cruel', 'heartless', 'cold', 'sacrifice'],
      'honest': ['honest', 'truth', 'transparent', 'straightforward', 'sincere'],
      'deceptive': ['lie', 'deceive', 'mislead', 'hide', 'secret', 'manipulate', 'trick'],
      'optimistic': ['optimistic', 'hopeful', 'positive', 'bright side', 'will work out'],
      'pessimistic': ['pessimistic', 'doomed', 'hopeless', 'worst', 'fail', 'never work'],
      'ambitious': ['ambitious', 'driven', 'goal', 'achieve', 'succeed', 'power', 'climb'],
      'content': ['content', 'satisfied', 'enough', 'peaceful', 'happy with'],
      'curious': ['curious', 'wonder', 'question', 'investigate', 'explore', 'discover'],
      'skeptical': ['skeptical', 'doubt', 'suspicious', 'question', 'prove it', 'unconvinced'],
      'patient': ['patient', 'wait', 'time', 'calm', 'endure', 'persevere'],
      'impulsive': ['impulsive', 'rash', 'hurry', 'now', 'immediately', 'without thinking'],
      'organized': ['organized', 'plan', 'methodical', 'systematic', 'order', 'structure'],
      'chaotic': ['chaotic', 'messy', 'disorganized', 'spontaneous', 'random', 'improvise'],
      'confident': ['confident', 'sure', 'certain', 'know', 'capable', 'self-assured'],
      'insecure': ['insecure', 'doubt', 'unsure', 'worry', 'not good enough', 'inadequate'],
      'charismatic': ['charismatic', 'charming', 'persuade', 'influence', 'captivate', 'magnetic'],
      'aloof': ['aloof', 'distant', 'detached', 'cold', 'reserved', 'unapproachable'],
      'humorous': ['funny', 'joke', 'laugh', 'humor', 'wit', 'amuse', 'lighthearted'],
      'serious': ['serious', 'grave', 'solemn', 'focused', 'no nonsense', 'stern'],
      'adaptable': ['adapt', 'flexible', 'adjust', 'change', 'pivot', 'improvise'],
      'stubborn': ['stubborn', 'refuse', 'won\'t', 'never', 'insist', 'unyielding', 'obstinate'],
    };

    return traitKeywords[trait.toLowerCase()] || [trait];
  }

  /**
   * Calculate expression strength
   */
  private calculateExpressionStrength(beat: string, keyword: string): number {
    const beatLower = beat.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    
    // Count occurrences
    const occurrences = (beatLower.match(new RegExp(keywordLower, 'g')) || []).length;
    
    // Base strength
    let strength = Math.min(1, 0.3 + occurrences * 0.2);
    
    // Boost if keyword is in prominent position
    if (beatLower.startsWith(keywordLower) || beatLower.endsWith(keywordLower)) {
      strength += 0.2;
    }
    
    return Math.min(1, strength);
  }

  /**
   * Check for contradictory trait expressions
   */
  private checkContradictions(
    character: CharacterProfile,
    expressions: TraitExpression[],
    issues: TraitIssue[]
  ): void {
    const contradictoryTraits: Record<string, string[]> = {
      'brave': ['cowardly'],
      'cowardly': ['brave'],
      'intelligent': ['naive'],
      'naive': ['intelligent'],
      'loyal': ['treacherous'],
      'treacherous': ['loyal'],
      'compassionate': ['ruthless'],
      'ruthless': ['compassionate'],
      'honest': ['deceptive'],
      'deceptive': ['honest'],
      'optimistic': ['pessimistic'],
      'pessimistic': ['optimistic'],
      'ambitious': ['content'],
      'content': ['ambitious'],
      'curious': ['skeptical'],
      'skeptical': ['curious'],
      'patient': ['impulsive'],
      'impulsive': ['patient'],
      'organized': ['chaotic'],
      'chaotic': ['organized'],
      'confident': ['insecure'],
      'insecure': ['confident'],
      'charismatic': ['aloof'],
      'aloof': ['charismatic'],
      'humorous': ['serious'],
      'serious': ['humorous'],
      'adaptable': ['stubborn'],
      'stubborn': ['adaptable'],
    };

    const expressedTraits = new Set(expressions.map(e => e.trait.toLowerCase()));
    
    for (const trait of expressedTraits) {
      const contradictions = contradictoryTraits[trait] || [];
      for (const contradiction of contradictions) {
        if (expressedTraits.has(contradiction)) {
          issues.push({
            type: 'trait-contradicted',
            severity: 'high',
            trait,
            description: `Contradictory traits expressed: "${trait}" and "${contradiction}"`,
            suggestion: 'Choose one dominant trait for this scene or show internal conflict explicitly',
          });
        }
      }
    }
  }

  /**
   * Check for overused traits
   */
  private checkOveruse(
    expressions: TraitExpression[],
    traits: string[],
    issues: TraitIssue[]
  ): void {
    const traitCounts = new Map<string, number>();
    for (const expr of expressions) {
      traitCounts.set(expr.trait, (traitCounts.get(expr.trait) || 0) + 1);
    }

    const totalBeats = Math.max(1, expressions.length);
    for (const [trait, count] of traitCounts) {
      const ratio = count / totalBeats;
      if (ratio > 0.7 && traits.length > 1) {
        issues.push({
          type: 'trait-overused',
          severity: 'medium',
          trait,
          description: `Trait "${trait}" expressed in ${Math.round(ratio * 100)}% of beats`,
          suggestion: 'Vary trait expressions; show other traits',
        });
      }
    }
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(
    traits: string[],
    expressions: TraitExpression[],
    issues: TraitIssue[]
  ): number {
    if (traits.length === 0) return 1.0;

    let score = 1.0;
    
    // Penalize for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'high': score -= 0.25; break;
        case 'medium': score -= 0.15; break;
        case 'low': score -= 0.05; break;
      }
    }

    // Reward for expressing multiple traits
    const expressedCount = new Set(expressions.map(e => e.trait)).size;
    const expressionRatio = expressedCount / traits.length;
    score = score * 0.5 + expressionRatio * 0.5;

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Factory for creating TraitEnforcer
 */
export async function createTraitEnforcer(
  config?: Partial<TraitEnforcerConfig>
): Promise<TraitEnforcer> {
  const skill = new TraitEnforcer();
  await skill.initialize(config);
  return skill;
}