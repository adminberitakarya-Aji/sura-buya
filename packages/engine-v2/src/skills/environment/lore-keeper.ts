/**
 * Suro-Buya Engine v2 - Lore Keeper Skill
 * 
 * Maintains and enforces world lore consistency across scenes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { EnvironmentSkill } from '../base.js';
import type { WorldProfile, SceneGenerationInput } from '../../types.js';

/**
 * Lore Keeper configuration
 */
export interface LoreKeeperConfig extends Record<string, unknown> {
  /** Check historical consistency */
  checkHistory: boolean;
  /** Check mythological consistency */
  checkMythology: boolean;
  /** Check magical/tech system consistency */
  checkSystems: boolean;
  /** Check faction/political consistency */
  checkFactions: boolean;
  /** Strictness level */
  strictness: 'lenient' | 'standard' | 'strict';
}

/**
 * Lore element
 */
export interface LoreElement {
  /** Element type */
  type: 'history' | 'mythology' | 'system' | 'faction' | 'geography' | 'culture';
  /** Element name */
  name: string;
  /** Description */
  description: string;
  /** Source world */
  worldId: string;
  /** Importance */
  importance: 'critical' | 'major' | 'minor';
  /** Related elements */
  related: string[];
}

/**
 * Lore consistency analysis
 */
export interface LoreAnalysis {
  /** World ID */
  worldId: string;
  /** Lore elements referenced */
  referencedElements: LoreElement[];
  /** Consistency score */
  consistencyScore: number;
  /** Issues detected */
  issues: LoreIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Lore issue
 */
export interface LoreIssue {
  /** Issue type */
  type: 'contradiction' | 'missing-context' | 'anachronism' | 'system-violation' | 'faction-inconsistency';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Element involved */
  element?: string;
  /** Scene beat index */
  beatIndex?: number;
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Lore Keeper Skill
 * Maintains world lore consistency
 */
export class LoreKeeper extends EnvironmentSkill<SceneGenerationInput, LoreAnalysis[]> {
  override name = 'LoreKeeper';
  override version = '1.0.0';
  override description = 'Maintains and enforces world lore consistency across scenes';
  override dependencies: string[] = [];
  override required = false;
  
  override configSchema = z.object({
    checkHistory: z.boolean().default(true),
    checkMythology: z.boolean().default(true),
    checkSystems: z.boolean().default(true),
    checkFactions: z.boolean().default(true),
    strictness: z.enum(['lenient', 'standard', 'strict']).default('standard'),
  });

  override defaultConfig: Record<string, unknown> = {
    checkHistory: true,
    checkMythology: true,
    checkSystems: true,
    checkFactions: true,
    strictness: 'standard',
  };

  protected override config: LoreKeeperConfig = {
    checkHistory: true,
    checkMythology: true,
    checkSystems: true,
    checkFactions: true,
    strictness: 'standard',
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<LoreAnalysis[]>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const analyses: LoreAnalysis[] = [];

      // Check each world in the scene
      for (const worldId of Object.keys(context.worldBibles)) {
        const world = context.worldBibles[worldId];
        if (!world) continue;

        const analysis = this.analyzeLoreConsistency(world, input, context, cfg);
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
   * Analyze lore consistency for a world
   */
  private analyzeLoreConsistency(
    world: WorldProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    cfg: LoreKeeperConfig
  ): LoreAnalysis {
    const issues: LoreIssue[] = [];
    const recommendations: string[] = [];
    const referencedElements: LoreElement[] = [];

    // Extract lore elements from world
    const loreElements = this.extractLoreElements(world);
    
    // Check scene beats against lore
    for (let i = 0; i < input.keyBeats.length; i++) {
      const beat = input.keyBeats[i];
      if (!beat) continue; // Skip undefined beats
      
      // Check for referenced lore elements
      const foundElements = this.findReferencedElements(beat, loreElements);
      referencedElements.push(...foundElements);
      
      // Check consistency based on config
      if (cfg.checkHistory) {
        this.checkHistoricalConsistency(beat, world, i, issues);
      }
      if (cfg.checkMythology) {
        this.checkMythologicalConsistency(beat, world, i, issues);
      }
      if (cfg.checkSystems) {
        this.checkSystemConsistency(beat, world, i, issues);
      }
      if (cfg.checkFactions) {
        this.checkFactionConsistency(beat, world, i, issues);
      }
    }

    // Check for anachronisms
    this.checkAnachronisms(input, world, issues);

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(issues, cfg.strictness);

    // Generate recommendations
    if (issues.some(i => i.type === 'contradiction')) {
      recommendations.push('Review scene beats for lore contradictions');
    }
    if (issues.some(i => i.type === 'system-violation')) {
      recommendations.push('Ensure magic/tech usage follows established rules');
    }
    if (referencedElements.length === 0 && loreElements.length > 0) {
      recommendations.push('Consider referencing established lore elements');
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
   * Extract lore elements from world profile
   */
  private extractLoreElements(world: WorldProfile): LoreElement[] {
    const elements: LoreElement[] = [];

    // History elements
    if (world.history) {
      for (const era of world.history.timeline) {
        elements.push({
          type: 'history',
          name: era.era,
          description: era.events.join('; '),
          worldId: world.id,
          importance: 'major',
          related: [],
        });
      }
      for (const event of world.history.keyEvents) {
        elements.push({
          type: 'history',
          name: event,
          description: `Key historical event: ${event}`,
          worldId: world.id,
          importance: 'critical',
          related: [],
        });
      }
    }

    // Culture elements
    if (world.culture) {
      for (const belief of world.culture.beliefs) {
        elements.push({
          type: 'mythology',
          name: belief,
          description: `Cultural belief: ${belief}`,
          worldId: world.id,
          importance: 'major',
          related: [],
        });
      }
      for (const custom of world.culture.customs) {
        elements.push({
          type: 'culture',
          name: custom,
          description: `Cultural custom: ${custom}`,
          worldId: world.id,
          importance: 'minor',
          related: [],
        });
      }
    }

    // Geography elements
    if (world.geography) {
      for (const landmark of world.geography.landmarks) {
        elements.push({
          type: 'geography',
          name: landmark,
          description: `Landmark: ${landmark}`,
          worldId: world.id,
          importance: 'major',
          related: [],
        });
      }
    }

    return elements;
  }

  /**
   * Find lore elements referenced in a beat
   */
  private findReferencedElements(beat: string, elements: LoreElement[]): LoreElement[] {
    const beatLower = beat.toLowerCase();
    const found: LoreElement[] = [];

    for (const element of elements) {
      const keywords = this.getElementKeywords(element);
      for (const keyword of keywords) {
        if (beatLower.includes(keyword.toLowerCase())) {
          found.push(element);
          break;
        }
      }
    }

    return found;
  }

  /**
   * Get keywords for a lore element
   */
  private getElementKeywords(element: LoreElement): string[] {
    const baseKeywords = element.name.toLowerCase().split(' ');
    const typeKeywords: Record<string, string[]> = {
      history: ['ancient', 'old', 'past', 'history', 'legend', 'myth', 'era', 'age'],
      mythology: ['god', 'goddess', 'deity', 'spirit', 'divine', 'sacred', 'blessed', 'cursed'],
      system: ['magic', 'spell', 'power', 'ability', 'tech', 'technology', 'system', 'rule'],
      faction: ['faction', 'guild', 'order', 'clan', 'house', 'organization', 'group'],
      geography: ['location', 'place', 'landmark', 'region', 'territory', 'border'],
      culture: ['tradition', 'custom', 'ritual', 'ceremony', 'festival', 'belief'],
    };

    return [...baseKeywords, ...(typeKeywords[element.type] || [])];
  }

  /**
   * Check historical consistency
   */
  private checkHistoricalConsistency(
    beat: string,
    world: WorldProfile,
    beatIndex: number,
    issues: LoreIssue[]
  ): void {
    if (!world.history) return;

    const beatLower = beat.toLowerCase();
    
    // Check for references to future events in past setting
    const futureKeywords = ['will be', 'future', 'eventually', 'someday', 'destiny'];
    const pastKeywords = ['ancient', 'forgotten', 'ruins', 'legend', 'myth', 'long ago'];
    
    const hasFuture = futureKeywords.some(kw => beatLower.includes(kw));
    const hasPast = pastKeywords.some(kw => beatLower.includes(kw));
    
    if (hasFuture && hasPast) {
      issues.push({
        type: 'anachronism',
        severity: 'medium',
        beatIndex,
        description: 'Beat mixes future and past temporal references',
        suggestion: 'Clarify temporal context or separate references',
      });
    }

    // Check against known historical events
    for (const event of world.history.keyEvents) {
      const eventLower = event.toLowerCase();
      if (beatLower.includes(eventLower)) {
        // Check if context contradicts known outcome
        // This would need deeper semantic analysis
      }
    }
  }

  /**
   * Check mythological consistency
   */
  private checkMythologicalConsistency(
    beat: string,
    world: WorldProfile,
    beatIndex: number,
    issues: LoreIssue[]
  ): void {
    if (!world.culture?.beliefs) return;

    const beatLower = beat.toLowerCase();
    
    // Check for deity/belief references
    for (const belief of world.culture.beliefs) {
      const beliefLower = belief.toLowerCase();
      if (beatLower.includes(beliefLower)) {
        // Check for contradictory usage
        const contradictionKeywords = ['fake', 'false', 'lie', 'myth', 'not real', 'made up'];
        const hasContradiction = contradictionKeywords.some(kw => 
          beatLower.includes(kw) && beatLower.indexOf(kw) < beatLower.indexOf(beliefLower) + 50
        );
        
        if (hasContradiction) {
          issues.push({
            type: 'contradiction',
            severity: 'high',
            element: belief,
            beatIndex,
            description: `Belief "${belief}" contradicted in beat`,
            suggestion: 'Respect established mythology or show character skepticism explicitly',
          });
        }
      }
    }
  }

  /**
   * Check magic/tech system consistency
   */
  private checkSystemConsistency(
    beat: string,
    world: WorldProfile,
    beatIndex: number,
    issues: LoreIssue[]
  ): void {
    // Check for magic/tech usage that violates established rules
    const beatLower = beat.toLowerCase();
    
    // Common system violation patterns
    const violationPatterns = [
      { pattern: 'unlimited power', violation: 'Infinite power contradicts most magic systems' },
      { pattern: 'no cost', violation: 'Magic/tech without cost violates conservation laws' },
      { pattern: 'instant master', violation: 'Instant mastery contradicts learning curves' },
      { pattern: 'break rule', violation: 'Explicitly breaking established rules' },
    ];

    for (const { pattern, violation } of violationPatterns) {
      if (beatLower.includes(pattern)) {
        issues.push({
          type: 'system-violation',
          severity: 'high',
          beatIndex,
          description: violation,
          suggestion: 'Follow established system rules or show consequences',
        });
      }
    }
  }

  /**
   * Check faction consistency
   */
  private checkFactionConsistency(
    beat: string,
    world: WorldProfile,
    beatIndex: number,
    issues: LoreIssue[]
  ): void {
    // Check for faction behavior inconsistencies
    // This would integrate with character relationship data
    const beatLower = beat.toLowerCase();
    
    // Placeholder for faction checking logic
    // In real implementation, would check character actions against faction alignments
  }

  /**
   * Check for anachronisms
   */
  private checkAnachronisms(
    input: SceneGenerationInput,
    world: WorldProfile,
    issues: LoreIssue[]
  ): void {
    if (!world.geography?.terrain) return;

    const allBeats = input.keyBeats.join(' ').toLowerCase();
    
    // Check for technology/terms that don't fit setting
    const settingType = this.inferSettingType(world);
    const anachronisms = this.getAnachronismsForSetting(settingType);
    
    for (const { term, replacement } of anachronisms) {
      if (allBeats.includes(term.toLowerCase())) {
        issues.push({
          type: 'anachronism',
          severity: 'medium',
          description: `"${term}" may be anachronistic for ${settingType} setting`,
          suggestion: replacement ? `Consider using "${replacement}" instead` : 'Verify term fits setting',
        });
      }
    }
  }

  /**
   * Infer setting type from world profile
   */
  private inferSettingType(world: WorldProfile): string {
    if (world.type === 'planet') {
      if (world.geography?.climate?.includes('space') || world.description?.includes('space')) {
        return 'sci-fi';
      }
      if (world.culture?.beliefs?.some(b => b.includes('magic') || b.includes('god'))) {
        return 'fantasy';
      }
      return 'modern';
    }
    return 'unknown';
  }

  /**
   * Get anachronisms for a setting type
   */
  private getAnachronismsForSetting(setting: string): Array<{ term: string; replacement?: string }> {
    const anachronisms: Record<string, Array<{ term: string; replacement?: string }>> = {
      fantasy: [
        { term: 'gun', replacement: 'crossbow' },
        { term: 'electricity', replacement: 'lightning magic' },
        { term: 'computer', replacement: 'scrying stone' },
        { term: 'phone', replacement: 'sending stone' },
        { term: 'car', replacement: 'carriage' },
        { term: 'plastic', replacement: 'resin' },
        { term: 'gunpowder', replacement: 'fire powder' },
      ],
      'sci-fi': [
        { term: 'magic', replacement: 'psionics' },
        { term: 'spell', replacement: 'program' },
        { term: 'potion', replacement: 'serum' },
        { term: 'sword', replacement: 'energy blade' },
        { term: 'horse', replacement: 'hoverbike' },
      ],
      modern: [
        { term: 'magic', replacement: 'trick' },
        { term: 'spell', replacement: 'technique' },
        { term: 'dragon', replacement: 'creature' },
      ],
    };

    return anachronisms[setting] || [];
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(issues: LoreIssue[], strictness: LoreKeeperConfig['strictness']): number {
    let score = 1.0;
    
    const severityWeights = {
      lenient: { high: 0.15, medium: 0.08, low: 0.03 },
      standard: { high: 0.25, medium: 0.15, low: 0.05 },
      strict: { high: 0.35, medium: 0.2, low: 0.1 },
    };

    const weights = severityWeights[strictness];
    
    for (const issue of issues) {
      score -= weights[issue.severity];
    }

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Factory for creating LoreKeeper
 */
export async function createLoreKeeper(
  config?: Partial<LoreKeeperConfig>
): Promise<LoreKeeper> {
  const skill = new LoreKeeper();
  await skill.initialize(config);
  return skill;
}