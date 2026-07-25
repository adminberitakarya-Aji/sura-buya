/**
 * Suro-Buya Engine v2 - Relationship Mapper Skill
 * 
 * Maps and validates character relationships within scenes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CharacterSkill } from '../base.js';
import type { CharacterProfile, SceneGenerationInput } from '../../types.js';

/**
 * Relationship Mapper configuration
 */
export interface RelationshipMapperConfig extends Record<string, unknown> {
  [key: string]: unknown;
  /** Check relationship consistency */
  checkConsistency: boolean;
  /** Validate relationship dynamics in dialogue */
  validateDynamics: boolean;
  /** Track relationship evolution */
  trackEvolution: boolean;
  /** Minimum interaction threshold */
  minInteractions: number;
}

/**
 * Character relationship
 */
export interface CharacterRelationship {
  /** Target character ID */
  targetId: string;
  /** Relationship type */
  type: string;
  /** Description */
  description: string;
  /** Strength (0-1) */
  strength: number;
  /** Current dynamic */
  dynamic: 'positive' | 'negative' | 'complex' | 'neutral';
  /** History */
  history?: string[];
}

/**
 * Relationship analysis result
 */
export interface RelationshipAnalysis {
  /** Character ID */
  characterId: string;
  /** Relationships in this scene */
  sceneRelationships: SceneRelationship[];
  /** Overall consistency score */
  consistencyScore: number;
  /** Issues detected */
  issues: RelationshipIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Relationship in a specific scene
 */
export interface SceneRelationship {
  /** Target character */
  targetId: string;
  /** Target character name */
  targetName: string;
  /** Relationship type */
  type: string;
  /** Interaction quality in this scene */
  interactionQuality: 'strong' | 'moderate' | 'weak' | 'none';
  /** Dynamic shown */
  dynamicShown: 'positive' | 'negative' | 'complex' | 'neutral';
  /** Beats involving this relationship */
  relevantBeats: string[];
}

/**
 * Relationship issue
 */
export interface RelationshipIssue {
  /** Issue type */
  type: 'missing-interaction' | 'dynamic-mismatch' | 'strength-inconsistent' | 'history-ignored' | 'new-relationship';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Characters involved */
  characters: [string, string];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Relationship Mapper Skill
 * Maps and validates character relationships in scenes
 */
export class RelationshipMapper extends CharacterSkill<SceneGenerationInput, RelationshipAnalysis[]> {
  override name = 'RelationshipMapper';
  override version = '1.0.0';
  override description = 'Maps and validates character relationships within scenes';
  override dependencies: string[] = ['VoiceConsistency', 'ArcProgression'];
  override required = false;
  
  override configSchema = z.object({
    checkConsistency: z.boolean().default(true),
    validateDynamics: z.boolean().default(true),
    trackEvolution: z.boolean().default(true),
    minInteractions: z.number().default(1),
  });

  override defaultConfig: Record<string, unknown> = {
    checkConsistency: true,
    validateDynamics: true,
    trackEvolution: true,
    minInteractions: 1,
  };

  protected override config: RelationshipMapperConfig = {
    checkConsistency: true,
    validateDynamics: true,
    trackEvolution: true,
    minInteractions: 1,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<RelationshipAnalysis[]>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const analyses: RelationshipAnalysis[] = [];

      for (const charId of input.characters) {
        const character = context.characterBibles[charId];
        if (!character) {
          analyses.push(this.createEmptyAnalysis(charId, 'Character not found'));
          continue;
        }

        const analysis = this.analyzeRelationships(character, input, context, cfg);
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
  private createEmptyAnalysis(characterId: string, reason: string): RelationshipAnalysis {
    return {
      characterId,
      sceneRelationships: [],
      consistencyScore: 0,
      issues: [{
        type: 'missing-interaction',
        severity: 'low',
        characters: [characterId, 'unknown'],
        description: reason,
        suggestion: 'Ensure character is in bible',
      }],
      recommendations: [],
    };
  }

  /**
   * Analyze relationships for a character in a scene
   */
  private analyzeRelationships(
    character: CharacterProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    cfg: RelationshipMapperConfig
  ): RelationshipAnalysis {
    const issues: RelationshipIssue[] = [];
    const recommendations: string[] = [];
    const sceneRelationships: SceneRelationship[] = [];

    // Get character's defined relationships
    const definedRelationships = character.relationships || {};
    
    // Check each other character in scene
    for (const otherCharId of input.characters) {
      if (otherCharId === character.id) continue;
      
      const otherCharacter = context.characterBibles[otherCharId];
      if (!otherCharacter) continue;

      const definedRel = definedRelationships[otherCharId] as CharacterRelationship | undefined;
      const sceneRel = this.analyzeSceneRelationship(
        character, 
        otherCharacter, 
        input, 
        definedRel,
        issues
      );
      sceneRelationships.push(sceneRel);
    }

    // Check for missing expected interactions
    if (cfg.checkConsistency) {
      this.checkMissingInteractions(character, input, definedRelationships as Record<string, CharacterRelationship>, issues);
    }

    // Validate dynamics
    if (cfg.validateDynamics) {
      this.validateDynamics(character, input, sceneRelationships, issues);
    }

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(sceneRelationships, issues);

    // Generate recommendations
    if (sceneRelationships.some(r => r.interactionQuality === 'none')) {
      recommendations.push('Add interactions for characters with defined relationships');
    }
    if (issues.some(i => i.type === 'dynamic-mismatch')) {
      recommendations.push('Align dialogue dynamics with established relationship types');
    }

    return {
      characterId: character.id,
      sceneRelationships,
      consistencyScore,
      issues,
      recommendations: [...new Set(recommendations)],
    };
  }

  /**
   * Analyze relationship between two characters in a scene
   */
  private analyzeSceneRelationship(
    character: CharacterProfile,
    other: CharacterProfile,
    input: SceneGenerationInput,
    definedRel: CharacterRelationship | undefined,
    issues: RelationshipIssue[]
  ): SceneRelationship {
    // Check if they interact in beats
    const relevantBeats = input.keyBeats.filter(beat => 
      beat.toLowerCase().includes(other.name.toLowerCase()) ||
      beat.toLowerCase().includes('together') ||
      beat.toLowerCase().includes('each other')
    );

    const interactionQuality = relevantBeats.length >= 2 ? 'strong' :
                               relevantBeats.length === 1 ? 'moderate' : 'weak';

    // Determine dynamic shown
    let dynamicShown: SceneRelationship['dynamicShown'] = 'neutral';
    if (definedRel) {
      dynamicShown = definedRel.dynamic;
    } else if (relevantBeats.length > 0) {
      // Infer from beat content
      const beatText = relevantBeats.join(' ').toLowerCase();
      if (beatText.includes('argu') || beatText.includes('fight') || beatText.includes('conflict')) {
        dynamicShown = 'negative';
      } else if (beatText.includes('support') || beatText.includes('help') || beatText.includes('care')) {
        dynamicShown = 'positive';
      } else if (beatText.includes('complex') || beatText.includes('tension')) {
        dynamicShown = 'complex';
      }
    }

    // Check for dynamic mismatch
    if (definedRel && definedRel.dynamic !== dynamicShown && dynamicShown !== 'neutral') {
      issues.push({
        type: 'dynamic-mismatch',
        severity: 'medium',
        characters: [character.id, other.id],
        description: `Relationship shows ${dynamicShown} dynamic but defined as ${definedRel.dynamic}`,
        suggestion: `Write interaction consistent with ${definedRel.dynamic} relationship`,
      });
    }

    // Check for new undeclared relationship
    if (!definedRel) {
      issues.push({
        type: 'new-relationship',
        severity: 'low',
        characters: [character.id, other.id],
        description: `Characters interact but no relationship defined`,
        suggestion: `Add relationship to ${character.name}'s profile`,
      });
    }

    return {
      targetId: other.id,
      targetName: other.name,
      type: definedRel?.type || 'undefined',
      interactionQuality,
      dynamicShown,
      relevantBeats,
    };
  }

  /**
   * Check for missing expected interactions
   */
  private checkMissingInteractions(
    character: CharacterProfile,
    input: SceneGenerationInput,
    relationships: Record<string, CharacterRelationship>,
    issues: RelationshipIssue[]
  ): void {
    for (const [targetId, rel] of Object.entries(relationships)) {
      // Skip if target not in scene
      if (!input.characters.includes(targetId)) continue;

      // Check if strong relationship has interaction
      if (rel.strength >= 0.7) {
        const hasInteraction = input.keyBeats.some(beat => 
          beat.toLowerCase().includes(targetId.toLowerCase())
        );
        
        if (!hasInteraction) {
          const target = character.relationships?.[targetId];
          issues.push({
            type: 'missing-interaction',
            severity: 'high',
            characters: [character.id, targetId],
            description: `Strong ${rel.type} relationship (${rel.strength}) but no interaction in scene`,
            suggestion: `Include beat involving ${target?.description || targetId}`,
          });
        }
      }
    }
  }

  /**
   * Validate relationship dynamics in scene
   */
  private validateDynamics(
    character: CharacterProfile,
    input: SceneGenerationInput,
    sceneRels: SceneRelationship[],
    issues: RelationshipIssue[]
  ): void {
    for (const rel of sceneRels) {
      // Check if dialogue reflects relationship
      // This would integrate with DialogueWriter output
      if (rel.interactionQuality === 'strong' && rel.dynamicShown === 'neutral') {
        issues.push({
          type: 'strength-inconsistent',
          severity: 'medium',
          characters: [character.id, rel.targetId],
          description: `Strong interaction but neutral dynamic for ${rel.type}`,
          suggestion: `Show ${rel.type} dynamic in dialogue and action`,
        });
      }
    }
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(
    relationships: SceneRelationship[],
    issues: RelationshipIssue[]
  ): number {
    if (relationships.length === 0) return 1.0;

    let score = 1.0;
    
    // Penalize for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'high': score -= 0.25; break;
        case 'medium': score -= 0.15; break;
        case 'low': score -= 0.05; break;
      }
    }

    // Penalize for non-interactions with defined relationships
    const definedRels = relationships.filter(r => r.type !== 'undefined');
    const noInteraction = definedRels.filter(r => r.interactionQuality === 'none').length;
    if (definedRels.length > 0) {
      score -= (noInteraction / definedRels.length) * 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Factory for creating RelationshipMapper
 */
export async function createRelationshipMapper(
  config?: Partial<RelationshipMapperConfig>
): Promise<RelationshipMapper> {
  const skill = new RelationshipMapper();
  await skill.initialize(config);
  return skill;
}