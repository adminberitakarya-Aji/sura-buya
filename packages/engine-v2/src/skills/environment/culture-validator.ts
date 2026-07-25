/**
 * Suro-Buya Engine v2 - Culture Validator Skill
 * 
 * Validates cultural consistency in scenes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { EnvironmentSkill } from '../base.js';
import type { WorldProfile, SceneGenerationInput, CharacterProfile } from '../../types.js';

  /**
   * Culture Validator configuration
   */
export interface CultureValidatorConfig extends Record<string, unknown> {
  /** Check social norms */
  checkNorms: boolean;
  /** Check customs/traditions */
  checkCustoms: boolean;
  /** Check language/dialect */
  checkLanguage: boolean;
  /** Check religious/spiritual practices */
  checkBeliefs: boolean;
  /** Check taboos */
  checkTaboos: boolean;
  /** Strictness level */
  strictness: 'lenient' | 'standard' | 'strict';
}

/**
 * Cultural element
 */
export interface CulturalElement {
  /** Element type */
  type: 'norm' | 'custom' | 'language' | 'belief' | 'taboo' | 'value';
  /** Element name */
  name: string;
  /** Description */
  description: string;
  /** Importance */
  importance: 'critical' | 'major' | 'minor';
  /** Applicable contexts */
  contexts: string[];
}

/**
 * Culture analysis result
 */
export interface CultureAnalysis {
  /** World ID */
  worldId: string;
  /** Cultural elements referenced */
  referencedElements: CulturalElement[];
  /** Consistency score */
  consistencyScore: number;
  /** Issues detected */
  issues: CultureIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Culture issue
 */
export interface CultureIssue {
  /** Issue type */
  type: 'norm-violation' | 'custom-ignored' | 'language-mismatch' | 'belief-contradiction' | 'taboo-broken' | 'value-conflict';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Element involved */
  element?: string;
  /** Character involved */
  characterId?: string;
  /** Beat index */
  beatIndex?: number;
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Culture Validator Skill
 * Validates cultural consistency in scenes
 */
export class CultureValidator extends EnvironmentSkill<SceneGenerationInput, CultureAnalysis[]> {
  override name = 'CultureValidator';
  override version = '1.0.0';
  override description = 'Validates cultural consistency in scenes';
  override dependencies: string[] = ['LoreKeeper', 'GeographyChecker'];
  override required = false;
  
  override configSchema = z.object({
    checkNorms: z.boolean().default(true),
    checkCustoms: z.boolean().default(true),
    checkLanguage: z.boolean().default(true),
    checkBeliefs: z.boolean().default(true),
    checkTaboos: z.boolean().default(true),
    strictness: z.enum(['lenient', 'standard', 'strict']).default('standard'),
  });

  override defaultConfig: Record<string, unknown> = {
    checkNorms: true,
    checkCustoms: true,
    checkLanguage: true,
    checkBeliefs: true,
    checkTaboos: true,
    strictness: 'standard',
  };

  protected override config: CultureValidatorConfig = {
    checkNorms: true,
    checkCustoms: true,
    checkLanguage: true,
    checkBeliefs: true,
    checkTaboos: true,
    strictness: 'standard',
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<CultureAnalysis[]>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const analyses: CultureAnalysis[] = [];

      for (const worldId of Object.keys(context.worldBibles)) {
        const world = context.worldBibles[worldId];
        if (!world || !world.culture) continue;

        const analysis = this.analyzeCulture(world, input, context, cfg);
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
   * Analyze cultural consistency for a world
   */
  private analyzeCulture(
    world: WorldProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    cfg: CultureValidatorConfig
  ): CultureAnalysis {
    const issues: CultureIssue[] = [];
    const recommendations: string[] = [];
    const referencedElements: CulturalElement[] = [];

    // Extract cultural elements
    const culturalElements = this.extractCulturalElements(world);
    
    // Check each beat
    for (let i = 0; i < input.keyBeats.length; i++) {
      const beat = input.keyBeats[i];
      if (!beat) continue; // Skip undefined beats
      const beatLower = beat.toLowerCase();

      // Check for referenced cultural elements
      const found = this.findReferencedElements(beat, culturalElements);
      referencedElements.push(...found);

      // Check norms
      if (cfg.checkNorms) {
        this.checkNorms(beat, world, input.characters, context, i, issues);
      }

      // Check customs
      if (cfg.checkCustoms) {
        this.checkCustoms(beat, world, input.characters, context, i, issues);
      }

      // Check language
      if (cfg.checkLanguage) {
        this.checkLanguage(beat, world, input.characters, context, i, issues);
      }

      // Check beliefs
      if (cfg.checkBeliefs) {
        this.checkBeliefs(beat, world, input.characters, context, i, issues);
      }

      // Check taboos
      if (cfg.checkTaboos) {
        this.checkTaboos(beat, world, input.characters, context, i, issues);
      }
    }

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(issues, cfg.strictness);

    // Generate recommendations
    if (issues.some(i => i.type === 'norm-violation')) {
      recommendations.push('Review social norms for character actions');
    }
    if (issues.some(i => i.type === 'taboo-broken')) {
      recommendations.push('Avoid taboo violations or show consequences');
    }
    if (referencedElements.length === 0 && culturalElements.length > 0) {
      recommendations.push('Consider referencing cultural elements for depth');
    }

    return {
      worldId: world.id,
      referencedElements: [...new Map(referencedElements.map(e => [e.name, e])).values()],
      consistencyScore,
      issues,
      recommendations: [...new Set(recommendations)],
    };
  }

  /**
   * Extract cultural elements from world profile
   */
  private extractCulturalElements(world: WorldProfile): CulturalElement[] {
    const elements: CulturalElement[] = [];

    if (!world.culture) return elements;

    // Customs (mapped to norms)
    if (world.culture.customs) {
      for (const custom of world.culture.customs) {
        elements.push({
          type: 'custom',
          name: custom,
          description: `Custom/tradition: ${custom}`,
          importance: 'major',
          contexts: ['ceremony', 'daily', 'celebration'],
        });
      }
    }

    // Beliefs
    if (world.culture.beliefs) {
      for (const belief of world.culture.beliefs) {
        elements.push({
          type: 'belief',
          name: belief,
          description: `Belief: ${belief}`,
          importance: 'critical',
          contexts: ['spiritual', 'moral', 'decision'],
        });
      }
    }

    // Social structure as values
    if (world.culture.socialStructure) {
      elements.push({
        type: 'value',
        name: world.culture.socialStructure,
        description: `Cultural value: ${world.culture.socialStructure}`,
        importance: 'major',
        contexts: ['decision', 'conflict', 'relationship'],
      });
    }

    // Language as cultural element
    if (world.culture.language) {
      for (const lang of world.culture.language) {
        elements.push({
          type: 'language',
          name: lang,
          description: `Language/dialect: ${lang}`,
          importance: 'major',
          contexts: ['communication', 'identity'],
        });
      }
    }

    return elements;
  }

  /**
   * Find cultural elements referenced in text
   */
  private findReferencedElements(text: string, elements: CulturalElement[]): CulturalElement[] {
    const textLower = text.toLowerCase();
    const found: CulturalElement[] = [];

    for (const element of elements) {
      const keywords = this.getElementKeywords(element);
      for (const keyword of keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          found.push(element);
          break;
        }
      }
    }

    return found;
  }

  /**
   * Get keywords for cultural element
   */
  private getElementKeywords(element: CulturalElement): string[] {
    const base = element.name.toLowerCase().split(' ');
    const typeKeywords: Record<string, string[]> = {
      norm: ['proper', 'expected', 'customary', 'polite', 'rude', 'respect', 'honor'],
      custom: ['tradition', 'ritual', 'ceremony', 'celebrate', 'observe', 'practice'],
      language: ['word', 'phrase', 'say', 'speak', 'tongue', 'dialect', 'accent'],
      belief: ['believe', 'faith', 'god', 'spirit', 'divine', 'sacred', 'blessed'],
      taboo: ['forbidden', 'taboo', 'must not', 'never', 'unthinkable', 'sacrilege'],
      value: ['important', 'cherish', 'prize', 'worth', 'meaning', 'principle'],
    };
    return [...base, ...(typeKeywords[element.type] || [])];
  }

  /**
   * Check social norms (inferred from customs and social structure)
   */
  private checkNorms(
    beat: string,
    world: WorldProfile,
    characterIds: string[],
    context: SkillContext,
    beatIndex: number,
    issues: CultureIssue[]
  ): void {
    if (!world.culture?.customs && !world.culture?.socialStructure) return;

    const beatLower = beat.toLowerCase();
    
    // Check customs as norms
    if (world.culture.customs) {
      for (const custom of world.culture.customs) {
        const customLower = custom.toLowerCase();
        
        // Check if beat violates custom
        const violationKeywords = this.getNormViolationKeywords(custom);
        for (const keyword of violationKeywords) {
          if (beatLower.includes(keyword)) {
            // Check which character
            let characterId: string | undefined;
            for (const cid of characterIds) {
              const char = context.characterBibles[cid];
              if (char && beatLower.includes(char.name.toLowerCase())) {
                characterId = cid;
                break;
              }
            }

            issues.push({
              type: 'norm-violation',
              severity: 'medium',
              element: custom,
              characterId,
              beatIndex,
              description: `Possible violation of custom "${custom}" in beat`,
              suggestion: `Ensure character behavior aligns with "${custom}" or show deliberate transgression`,
            });
            break;
          }
        }
      }
    }
  }

  /**
   * Get keywords indicating norm violation
   */
  private getNormViolationKeywords(norm: string): string[] {
    const normLower = norm.toLowerCase();
    const violations: string[] = [];

    if (normLower.includes('respect') || normLower.includes('honor')) {
      violations.push('disrespect', 'insult', 'mock', 'ridicule');
    }
    if (normLower.includes('polite') || normLower.includes('courteous')) {
      violations.push('rude', 'blunt', 'interrupt', 'ignore');
    }
    if (normLower.includes('modest') || normLower.includes('humble')) {
      violations.push('boast', 'brag', 'show off', 'arrogant');
    }
    if (normLower.includes('hospitality') || normLower.includes('guest')) {
      violations.push('refuse', 'reject guest', 'inhospitable');
    }

    return violations;
  }

  /**
   * Check customs/traditions
   */
  private checkCustoms(
    beat: string,
    world: WorldProfile,
    characterIds: string[],
    context: SkillContext,
    beatIndex: number,
    issues: CultureIssue[]
  ): void {
    if (!world.culture?.customs) return;

    const beatLower = beat.toLowerCase();
    
    for (const custom of world.culture.customs) {
      const customLower = custom.toLowerCase();
      
      // Check if custom is relevant but ignored
      if (beatLower.includes(customLower)) {
        // Custom is referenced - good
      } else {
        // Check if scene context suggests custom should apply
        const contextKeywords = this.getCustomContextKeywords(custom);
        const relevant = contextKeywords.some(kw => beatLower.includes(kw));
        
        if (relevant) {
          issues.push({
            type: 'custom-ignored',
            severity: 'low',
            element: custom,
            beatIndex,
            description: `Custom "${custom}" may apply to this scene but not referenced`,
            suggestion: `Consider incorporating "${custom}" tradition`,
          });
        }
      }
    }
  }

  /**
   * Get context keywords for custom
   */
  private getCustomContextKeywords(custom: string): string[] {
    const customLower = custom.toLowerCase();
    const keywords: string[] = [];

    if (customLower.includes('greeting') || customLower.includes('welcome')) {
      keywords.push('meet', 'arrive', 'enter', 'greet');
    }
    if (customLower.includes('meal') || customLower.includes('feast') || customLower.includes('eat')) {
      keywords.push('eat', 'meal', 'food', 'dine', 'hungry');
    }
    if (customLower.includes('farewell') || customLower.includes('goodbye') || customLower.includes('depart')) {
      keywords.push('leave', 'depart', 'go', 'farewell');
    }
    if (customLower.includes('celebration') || customLower.includes('festival')) {
      keywords.push('celebrate', 'party', 'festival', 'victory', 'birth');
    }

    return keywords;
  }

  /**
   * Check language/dialect
   */
  private checkLanguage(
    beat: string,
    world: WorldProfile,
    characterIds: string[],
    context: SkillContext,
    beatIndex: number,
    issues: CultureIssue[]
  ): void {
    if (!world.culture?.language) return;

    // Check character dialogue for language consistency
    // This would integrate with DialogueWriter output
    for (const cid of characterIds) {
      const character = context.characterBibles[cid];
      if (!character || !character.voice) continue;

      // Check if character uses language markers from their culture
      const charLanguages = character.voice.vocabulary || [];
      // In real implementation, would check actual dialogue
    }
  }

  /**
   * Check beliefs
   */
  private checkBeliefs(
    beat: string,
    world: WorldProfile,
    characterIds: string[],
    context: SkillContext,
    beatIndex: number,
    issues: CultureIssue[]
  ): void {
    if (!world.culture?.beliefs) return;

    const beatLower = beat.toLowerCase();
    
    for (const belief of world.culture.beliefs) {
      const beliefLower = belief.toLowerCase();
      
      if (beatLower.includes(beliefLower)) {
        // Check for contradiction
        const contradictionKeywords = ['fake', 'false', 'lie', 'myth', 'not real', 'made up', 'superstition'];
        for (const kw of contradictionKeywords) {
          if (beatLower.includes(kw) && beatLower.indexOf(kw) < beatLower.indexOf(beliefLower) + 100) {
            // Find character
            let characterId: string | undefined;
            for (const cid of characterIds) {
              const char = context.characterBibles[cid];
              if (char && beatLower.includes(char.name.toLowerCase())) {
                characterId = cid;
                break;
              }
            }

            issues.push({
              type: 'belief-contradiction',
              severity: 'high',
              element: belief,
              characterId,
              beatIndex,
              description: `Belief "${belief}" contradicted in beat`,
              suggestion: 'Show character skepticism explicitly rather than stating belief is false',
            });
            break;
          }
        }
      }
    }
  }

  /**
   * Check taboos (inferred from negative customs/beliefs)
   */
  private checkTaboos(
    beat: string,
    world: WorldProfile,
    characterIds: string[],
    context: SkillContext,
    beatIndex: number,
    issues: CultureIssue[]
  ): void {
    if (!world.culture?.customs && !world.culture?.beliefs) return;

    const beatLower = beat.toLowerCase();
    
    // Check customs for taboo-like patterns
    if (world.culture.customs) {
      for (const custom of world.culture.customs) {
        const customLower = custom.toLowerCase();
        if (customLower.includes('never') || customLower.includes('forbidden') || customLower.includes('must not')) {
          // This custom implies a taboo
          const tabooKeywords = this.getTabooKeywords(custom);
          for (const keyword of tabooKeywords) {
            if (beatLower.includes(keyword)) {
              // Find character
              let characterId: string | undefined;
              for (const cid of characterIds) {
                const char = context.characterBibles[cid];
                if (char && beatLower.includes(char.name.toLowerCase())) {
                  characterId = cid;
                  break;
                }
              }

              issues.push({
                type: 'taboo-broken',
                severity: 'high',
                element: custom,
                characterId,
                beatIndex,
                description: `Taboo implied by custom "${custom}" potentially broken in beat`,
                suggestion: 'Show severe consequences or deliberate transgression with motivation',
              });
              break;
            }
          }
        }
      }
    }
    
    // Check beliefs for taboo-like patterns
    if (world.culture.beliefs) {
      for (const belief of world.culture.beliefs) {
        const beliefLower = belief.toLowerCase();
        if (beliefLower.includes('sacred') || beliefLower.includes('holy') || beliefLower.includes('divine')) {
          // This belief implies a taboo against desecration
          const tabooKeywords = this.getTabooKeywords(belief);
          for (const keyword of tabooKeywords) {
            if (beatLower.includes(keyword)) {
              // Find character
              let characterId: string | undefined;
              for (const cid of characterIds) {
                const char = context.characterBibles[cid];
                if (char && beatLower.includes(char.name.toLowerCase())) {
                  characterId = cid;
                  break;
                }
              }

              issues.push({
                type: 'taboo-broken',
                severity: 'high',
                element: belief,
                characterId,
                beatIndex,
                description: `Taboo implied by belief "${belief}" potentially broken in beat`,
                suggestion: 'Show severe consequences or deliberate transgression with motivation',
              });
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Get keywords indicating taboo violation
   */
  private getTabooKeywords(taboo: string): string[] {
    const tabooLower = taboo.toLowerCase();
    const keywords: string[] = [];

    // Direct references
    keywords.push(tabooLower.replace('don\'t ', '').replace('never ', '').replace('must not ', ''));
    
    // Action-oriented
    if (tabooLower.includes('kill') || tabooLower.includes('murder')) {
      keywords.push('kill', 'murder', 'slay', 'execute');
    }
    if (tabooLower.includes('steal') || tabooLower.includes('theft')) {
      keywords.push('steal', 'take', 'thief', 'rob');
    }
    if (tabooLower.includes('lie') || tabooLower.includes('deceive')) {
      keywords.push('lie', 'deceive', 'false', 'trick');
    }
    if (tabooLower.includes('sacred') || tabooLower.includes('holy')) {
      keywords.push('desecrate', 'defile', 'profane', 'destroy');
    }

    return keywords;
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(issues: CultureIssue[], strictness: CultureValidatorConfig['strictness']): number {
    let score = 1.0;
    
    const weights = {
      lenient: { high: 0.15, medium: 0.08, low: 0.03 },
      standard: { high: 0.25, medium: 0.15, low: 0.05 },
      strict: { high: 0.35, medium: 0.2, low: 0.1 },
    };

    const w = weights[strictness];
    
    for (const issue of issues) {
      score -= w[issue.severity];
    }

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Factory for creating CultureValidator
 */
export async function createCultureValidator(
  config?: Partial<CultureValidatorConfig>
): Promise<CultureValidator> {
  const skill = new CultureValidator();
  await skill.initialize(config);
  return skill;
}