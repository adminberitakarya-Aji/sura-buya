/**
 * Suro-Buya Engine v2 - Canon Validator Skill
 * 
 * Validates generated content against universe bible canon.
 * Checks characters, locations, lore, and continuity rules.
 */

import { z } from 'zod';
import type { 
  Skill, 
  SkillContext, 
  SkillResult, 
  SkillMetadata 
} from '../base.js';
import { ValidationSkill } from '../base.js';
import type { UniverseConfig, CharacterProfile, WorldProfile, EpisodeStructure } from '../../types.js';

/**
 * Canon validation issue
 */
export interface CanonIssue {
  type: 'character' | 'location' | 'lore' | 'timeline' | 'rule' | 'consistency';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    scene?: number;
    paragraph?: number;
    offset?: number;
  };
  reference?: string;
  suggestion?: string;
}

/**
 * Canon validation result
 */
export interface CanonValidationResult {
  valid: boolean;
  issues: CanonIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  checkedElements: {
    characters: number;
    locations: number;
    loreEntries: number;
    timelineEvents: number;
    rules: number;
  };
}

/**
 * Configuration for CanonValidator
 */
export const CanonValidatorConfigSchema = z.object({
  strictMode: z.boolean().default(true),
  checkCharacters: z.boolean().default(true),
  checkLocations: z.boolean().default(true),
  checkLore: z.boolean().default(true),
  checkTimeline: z.boolean().default(true),
  checkCustomRules: z.boolean().default(true),
  maxIssues: z.number().default(100),
  similarityThreshold: z.number().min(0).max(1).default(0.85),
  allowUnknownReferences: z.boolean().default(false),
});

export type CanonValidatorConfig = z.infer<typeof CanonValidatorConfigSchema>;

/**
 * CanonValidator Skill - Validates content against universe canon
 */
export class CanonValidator extends ValidationSkill<string, CanonValidationResult> {
  override name = 'CanonValidator';
  override version = '1.0.0';
  override description = 'Validates generated content against universe bible canon';
  override category = 'audit' as const;
  override dependencies = ['ContinuityGuard'];
  override required = true;
  override configSchema = CanonValidatorConfigSchema;
  override defaultConfig: CanonValidatorConfig = {
    strictMode: true,
    checkCharacters: true,
    checkLocations: true,
    checkLore: true,
    checkTimeline: true,
    checkCustomRules: true,
    maxIssues: 100,
    similarityThreshold: 0.85,
    allowUnknownReferences: false,
  };

  protected override config: CanonValidatorConfig = this.defaultConfig;

  override async initialize(config?: Record<string, unknown>): Promise<void> {
    this.config = { ...this.defaultConfig, ...config } as CanonValidatorConfig;
    const result = this.configSchema.safeParse(this.config);
    if (!result.success) {
      throw new Error(`Invalid config for ${this.name}: ${result.error.message}`);
    }
  }

  async validate(input: string, context: SkillContext): Promise<SkillResult<CanonValidationResult>> {
    const issues: CanonIssue[] = [];
    const checked = {
      characters: 0,
      locations: 0,
      loreEntries: 0,
      timelineEvents: 0,
      rules: 0,
    };

    try {
      // Check characters
      if (this.config.checkCharacters && context.characterBibles) {
        const charIssues = await this.validateCharacters(input, context.characterBibles);
        issues.push(...charIssues);
        checked.characters = Object.keys(context.characterBibles).length;
      }

      // Check locations
      if (this.config.checkLocations && context.worldBibles) {
        const locIssues = await this.validateLocations(input, context.worldBibles);
        issues.push(...locIssues);
        checked.locations = Object.keys(context.worldBibles).length;
      }

      // Check lore (using history.timeline from WorldProfile)
      if (this.config.checkLore && context.worldBibles) {
        const loreIssues = await this.validateLore(input, context.worldBibles);
        issues.push(...loreIssues);
        checked.loreEntries = Object.values(context.worldBibles).reduce(
          (sum, wb) => sum + (wb.history?.timeline?.reduce((s: number, era: any) => s + (era.events?.length || 0), 0) || 0), 0
        );
      }

      // Check timeline
      if (this.config.checkTimeline && context.worldBibles) {
        const timelineIssues = await this.validateTimeline(input, context.worldBibles, context);
        issues.push(...timelineIssues);
        checked.timelineEvents = Object.values(context.worldBibles).reduce(
          (sum, wb) => sum + (wb.history?.timeline?.reduce((s: number, era: any) => s + (era.events?.length || 0), 0) || 0), 0
        );
      }

      // Check custom rules
      if (this.config.checkCustomRules && context.universeConfig) {
        const ruleIssues = await this.validateCustomRules(input, context.universeConfig);
        issues.push(...ruleIssues);
        checked.rules = (context.universeConfig.metadata?.['canonRules'] as any[])?.length || 0;
      }

      // Sort by severity
      const severityOrder = { error: 0, warning: 1, info: 2 };
      issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // Limit issues
      const limitedIssues = issues.slice(0, this.config.maxIssues);

      const summary = {
        errors: limitedIssues.filter(i => i.severity === 'error').length,
        warnings: limitedIssues.filter(i => i.severity === 'warning').length,
        infos: limitedIssues.filter(i => i.severity === 'info').length,
      };

      const result: CanonValidationResult = {
        valid: summary.errors === 0,
        issues: limitedIssues,
        summary,
        checkedElements: checked,
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
        warnings: limitedIssues.filter(i => i.severity === 'warning').map(i => i.message),
      };
    } catch (error) {
      return {
        success: false,
        error: `Canon validation failed: ${(error as Error).message}`,
        metadata: {
          skillName: this.name,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    }
  }

  // Abstract method required by ValidationSkill
  override async execute(input: string, context: SkillContext): Promise<SkillResult<CanonValidationResult>> {
    return this.validate(input, context);
  }

  /**
   * Validate character references and consistency
   */
  private async validateCharacters(
    content: string, 
    characterBibles: Record<string, CharacterProfile>
  ): Promise<CanonIssue[]> {
    const issues: CanonIssue[] = [];
    const contentLower = content.toLowerCase();

    for (const [charId, bible] of Object.entries(characterBibles)) {
      const charName = bible.name.toLowerCase();
      const aliases: string[] = []; // CharacterProfile doesn't have aliases field
      const allNames = [charName, ...aliases];

      // Check if character is mentioned
      const mentioned = allNames.some(name => contentLower.includes(name));
      if (!mentioned) continue;

      // Check voice consistency
      if (bible.voice) {
        const voiceIssues = this.checkVoiceConsistency(content, bible);
        issues.push(...voiceIssues);
      }

      // Check relationships
      if (bible.relationships) {
        for (const [targetChar, relationship] of Object.entries(bible.relationships)) {
          if (contentLower.includes(targetChar.toLowerCase())) {
            const relIssues = this.checkRelationshipConsistency(content, bible, targetChar, relationship);
            issues.push(...relIssues);
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check character voice consistency
   */
  private checkVoiceConsistency(content: string, bible: CharacterProfile): CanonIssue[] {
    const issues: CanonIssue[] = [];
    const voiceGuide = bible.voice;
    
    if (!voiceGuide) return issues;

    // Check for forbidden words/phrases (using traits as forbidden patterns)
    if (bible.weaknesses) {
      for (const word of bible.weaknesses) {
        if (content.toLowerCase().includes(word.toLowerCase())) {
          issues.push({
            type: 'character',
            severity: 'warning',
            message: `Character "${bible.name}" uses trait/word that may be a weakness: "${word}"`,
            reference: `character:${bible.id}:voice:weakness`,
            suggestion: `Consider if "${word}" aligns with character voice`,
          });
        }
      }
    }

    // Check required speech patterns (using voice.speechPatterns)
    if (voiceGuide.speechPatterns) {
      for (const pattern of voiceGuide.speechPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (!regex.test(content)) {
          issues.push({
            type: 'character',
            severity: 'info',
            message: `Character "${bible.name}" may be missing speech pattern: ${pattern}`,
            reference: `character:${bible.id}:voice:pattern`,
            suggestion: `Consider incorporating pattern: ${pattern}`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check relationship consistency
   */
  private checkRelationshipConsistency(
    content: string, 
    bible: CharacterProfile, 
    targetChar: string, 
    relationship: any
  ): CanonIssue[] {
    const issues: CanonIssue[] = [];
    
    if (relationship.type && content.toLowerCase().includes(targetChar.toLowerCase())) {
      const dynamicKeywords = this.getDynamicKeywords(relationship.type);
      const hasAppropriateTone = dynamicKeywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()));
      
      if (!hasAppropriateTone && dynamicKeywords.length > 0) {
        issues.push({
          type: 'character',
          severity: 'info',
          message: `Interaction between "${bible.name}" and "${targetChar}" may not reflect ${relationship.type} dynamic`,
          reference: `character:${bible.id}:relationship:${targetChar}`,
          suggestion: `Consider dialogue/actions that show ${relationship.type} relationship`,
        });
      }
    }

    return issues;
  }

  private getDynamicKeywords(dynamic: string): string[] {
    const dynamics: Record<string, string[]> = {
      'friends': ['laugh', 'joke', 'support', 'comfort', 'tease'],
      'enemies': ['threat', 'insult', 'challenge', 'oppose', 'hate'],
      'lovers': ['tender', 'intimate', 'care', 'protect', 'love'],
      'rivals': ['compete', 'challenge', 'prove', 'surpass', 'beat'],
      'mentor-student': ['teach', 'guide', 'lesson', 'learn', 'advice'],
      'family': ['care', 'protect', 'worry', 'proud', 'family'],
      'strangers': ['formal', 'polite', 'cautious', 'introduce'],
    };
    return dynamics[dynamic.toLowerCase()] || [];
  }

  /**
   * Validate location references
   */
  private async validateLocations(
    content: string, 
    worldBibles: Record<string, WorldProfile>
  ): Promise<CanonIssue[]> {
    const issues: CanonIssue[] = [];
    const contentLower = content.toLowerCase();

    for (const [worldId, worldBible] of Object.entries(worldBibles)) {
      // WorldProfile has geography.landmarks, not locations array
      if (worldBible.geography?.landmarks) {
        for (const location of worldBible.geography.landmarks) {
          const locName = location.toLowerCase();
          const allNames = [locName];

          if (allNames.some(name => contentLower.includes(name))) {
            // Check accessibility from connections
            if (worldBible.connections && worldBible.connections.length > 0) {
              const accessIssues = this.checkLocationAccess(content, location, worldBible);
              issues.push(...accessIssues);
            }
          }
        }
      }
    }

    return issues;
  }

  private checkLocationAccess(content: string, location: string, worldBible: WorldProfile): CanonIssue[] {
    const issues: CanonIssue[] = [];
    // Simplified check - in production would check if location is reachable from current location
    if (worldBible.connections && worldBible.connections.length > 0) {
      issues.push({
        type: 'location',
        severity: 'info',
        message: `Character visits "${location}" - verify accessibility from current location`,
        reference: `location:${worldBible.id}:${location}:access`,
        suggestion: 'Ensure narrative explains travel or transition to this location',
      });
    }
    return issues;
  }

  /**
   * Validate lore references (using history timeline)
   */
  private async validateLore(
    content: string, 
    worldBibles: Record<string, WorldProfile>
  ): Promise<CanonIssue[]> {
    const issues: CanonIssue[] = [];
    const contentLower = content.toLowerCase();

    for (const [worldId, worldBible] of Object.entries(worldBibles)) {
      if (worldBible.history?.timeline) {
        for (const era of worldBible.history.timeline) {
          for (const event of era.events || []) {
            const keywords = this.extractKeywords(event);
            
            for (const keyword of keywords) {
              if (contentLower.includes(keyword.toLowerCase())) {
                const contradiction = this.checkLoreContradiction(content, event, era);
                if (contradiction) {
                  issues.push({
                    type: 'lore',
                    severity: 'error',
                    message: `Lore contradiction: ${contradiction}`,
                    reference: `lore:${worldId}:${era.era}:${event}`,
                    suggestion: `Align with established lore: ${event.substring(0, 100)}...`,
                  });
                }
              }
            }
          }
        }
      }
    }

    return issues;
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[.,!?;:"'()]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    const unique = [...new Set(words)];
    return unique.sort((a, b) => b.length - a.length).slice(0, 20);
  }

  private checkLoreContradiction(content: string, loreEntry: string, era: any): string | null {
    // Check for direct contradictions in lore
    if (era.keyEvents && era.keyEvents.includes(loreEntry)) {
      // Key events are critical - check for negation
      const contentLower = content.toLowerCase();
      const negations = ['never happened', 'did not happen', 'false', 'lie', 'myth'];
      for (const neg of negations) {
        if (contentLower.includes(neg)) {
          return `Content negates key historical event: ${loreEntry}`;
        }
      }
    }
    return null;
  }

  /**
   * Validate timeline consistency
   */
  private async validateTimeline(
    content: string, 
    worldBibles: Record<string, WorldProfile>,
    context: SkillContext
  ): Promise<CanonIssue[]> {
    const issues: CanonIssue[] = [];

    for (const [worldId, worldBible] of Object.entries(worldBibles)) {
      if (worldBible.history?.timeline) {
        for (const era of worldBible.history.timeline) {
          for (const event of era.events || []) {
            if (content.toLowerCase().includes(event.toLowerCase())) {
              // Check temporal consistency using episode number
              if (context.episodeStructure) {
                const episodeNumber = context.episodeStructure.number;
                // Simplified: use era name as temporal marker
                if (era.era && !era.era.toLowerCase().includes('past') && !era.era.toLowerCase().includes('history')) {
                  issues.push({
                    type: 'timeline',
                    severity: 'warning',
                    message: `References event "${event}" from era "${era.era}" - verify temporal consistency`,
                    reference: `timeline:${worldId}:${era.era}:${event}`,
                    suggestion: 'Ensure reference aligns with current story timeline',
                  });
                }
              }
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Validate custom universe rules
   */
  private async validateCustomRules(
    content: string, 
    universeConfig: UniverseConfig
  ): Promise<CanonIssue[]> {
    const issues: CanonIssue[] = [];

    // Check for canonRules in metadata
    const canonRules = (universeConfig.metadata?.['canonRules'] as any[]) || [];
    
    for (const rule of canonRules) {
      if (rule.pattern && rule.severity) {
        const regex = new RegExp(rule.pattern, rule.flags || 'i');
        const matches = content.match(regex);
        
        if (matches && rule.type === 'forbidden') {
          for (const match of matches) {
            issues.push({
              type: 'rule',
              severity: rule.severity as 'error' | 'warning' | 'info',
              message: `Canon rule violated: ${rule.description} - matched "${match}"`,
              reference: `rule:${rule.id}`,
              suggestion: rule.suggestion || 'Revise content to comply with rule',
            });
          }
        } else if (!matches && rule.type === 'required') {
          issues.push({
            type: 'rule',
            severity: rule.severity as 'error' | 'warning' | 'info',
            message: `Required canon rule not satisfied: ${rule.description}`,
            reference: `rule:${rule.id}`,
            suggestion: rule.suggestion || `Include content matching pattern: ${rule.pattern}`,
          });
        }
      }
    }

    return issues;
  }
}

/**
 * Factory function for CanonValidator
 */
export async function createCanonValidator(config?: Record<string, unknown>): Promise<CanonValidator> {
  const validator = new CanonValidator();
  await validator.initialize(config);
  return validator;
}
