/**
 * Suro-Buya Engine v2 - Arc Progression Skill
 * 
 * Tracks and enforces character arc progression across scenes and episodes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CharacterSkill } from '../base.js';
import type { CharacterProfile, SceneGenerationInput, EpisodeGenerationInput } from '../../types.js';

/**
 * Arc Progression configuration
 */
export interface ArcProgressionConfig extends Record<string, unknown> {
  [key: string]: unknown;
  /** Track arc stages */
  trackStages: boolean;
  /** Enforce stage transitions */
  enforceTransitions: boolean;
  /** Minimum scenes per arc stage */
  minScenesPerStage: number;
  /** Arc stages definition */
  stages: ArcStage[];
}

/**
 * Character arc stage
 */
export interface ArcStage {
  /** Stage name */
  name: string;
  /** Stage order */
  order: number;
  /** Description */
  description: string;
  /** Required beats or milestones */
  milestones: string[];
  /** Emotional range */
  emotionalRange: string[];
}

/**
 * Arc progression analysis
 */
export interface ArcProgressionAnalysis {
  /** Character ID */
  characterId: string;
  /** Current arc stage */
  currentStage: string;
  /** Stage progress (0-1) */
  stageProgress: number;
  /** Scenes in current stage */
  scenesInStage: number;
  /** Overall arc progress (0-1) */
  overallProgress: number;
  /** Completed milestones */
  completedMilestones: string[];
  /** Pending milestones */
  pendingMilestones: string[];
  /** Issues detected */
  issues: ArcIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Arc progression issue
 */
export interface ArcIssue {
  /** Issue type */
  type: 'stage-skipped' | 'stage-stalled' | 'milestone-missing' | 'emotional-inconsistent' | 'arc-incomplete';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Scene number */
  sceneNumber?: number;
  /** Description */
  description: string;
  /** Suggestion to fix */
  suggestion: string;
}

/**
 * Arc Progression Skill
 * Tracks character arc progression across the narrative
 */
export class ArcProgression extends CharacterSkill<SceneGenerationInput, ArcProgressionAnalysis[]> {
  override name = 'ArcProgression';
  override version = '1.0.0';
  override description = 'Tracks and enforces character arc progression across scenes and episodes';
  override dependencies: string[] = ['VoiceConsistency'];
  override required = false;
  
  override configSchema = z.object({
    trackStages: z.boolean().default(true),
    enforceTransitions: z.boolean().default(true),
    minScenesPerStage: z.number().default(2),
    stages: z.array(z.object({
      name: z.string(),
      order: z.number(),
      description: z.string(),
      milestones: z.array(z.string()),
      emotionalRange: z.array(z.string()),
    })).default([
      { name: 'setup', order: 1, description: 'Character introduced, status quo established', milestones: ['introduction', 'status-quo'], emotionalRange: ['neutral', 'curious', 'content'] },
      { name: 'inciting', order: 2, description: 'Inciting incident disrupts status quo', milestones: ['inciting-incident', 'initial-reaction'], emotionalRange: ['shocked', 'confused', 'denial', 'angry'] },
      { name: 'rising', order: 3, description: 'Character faces escalating challenges', milestones: ['first-challenge', 'failure', 'adaptation'], emotionalRange: ['determined', 'frustrated', 'hopeful', 'desperate'] },
      { name: 'climax', order: 4, description: 'Character faces ultimate test', milestones: ['ultimate-challenge', 'critical-choice'], emotionalRange: ['determined', 'terrified', 'resolute', 'transcendent'] },
      { name: 'resolution', order: 5, description: 'Character changed, new status quo', milestones: ['aftermath', 'new-equilibrium'], emotionalRange: ['peaceful', 'wistful', 'confident', 'changed'] },
    ]),
  });

  override defaultConfig: Record<string, unknown> = {
    trackStages: true,
    enforceTransitions: true,
    minScenesPerStage: 2,
    stages: [
      { name: 'setup', order: 1, description: 'Character introduced, status quo established', milestones: ['introduction', 'status-quo'], emotionalRange: ['neutral', 'curious', 'content'] },
      { name: 'inciting', order: 2, description: 'Inciting incident disrupts status quo', milestones: ['inciting-incident', 'initial-reaction'], emotionalRange: ['shocked', 'confused', 'denial', 'angry'] },
      { name: 'rising', order: 3, description: 'Character faces escalating challenges', milestones: ['first-challenge', 'failure', 'adaptation'], emotionalRange: ['determined', 'frustrated', 'hopeful', 'desperate'] },
      { name: 'climax', order: 4, description: 'Character faces ultimate test', milestones: ['ultimate-challenge', 'critical-choice'], emotionalRange: ['determined', 'terrified', 'resolute', 'transcendent'] },
      { name: 'resolution', order: 5, description: 'Character changed, new status quo', milestones: ['aftermath', 'new-equilibrium'], emotionalRange: ['peaceful', 'wistful', 'confident', 'changed'] },
    ],
  };

  protected override config: ArcProgressionConfig = {
    trackStages: true,
    enforceTransitions: true,
    minScenesPerStage: 2,
    stages: [
      { name: 'setup', order: 1, description: 'Character introduced, status quo established', milestones: ['introduction', 'status-quo'], emotionalRange: ['neutral', 'curious', 'content'] },
      { name: 'inciting', order: 2, description: 'Inciting incident disrupts status quo', milestones: ['inciting-incident', 'initial-reaction'], emotionalRange: ['shocked', 'confused', 'denial', 'angry'] },
      { name: 'rising', order: 3, description: 'Character faces escalating challenges', milestones: ['first-challenge', 'failure', 'adaptation'], emotionalRange: ['determined', 'frustrated', 'hopeful', 'desperate'] },
      { name: 'climax', order: 4, description: 'Character faces ultimate test', milestones: ['ultimate-challenge', 'critical-choice'], emotionalRange: ['determined', 'terrified', 'resolute', 'transcendent'] },
      { name: 'resolution', order: 5, description: 'Character changed, new status quo', milestones: ['aftermath', 'new-equilibrium'], emotionalRange: ['peaceful', 'wistful', 'confident', 'changed'] },
    ],
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<ArcProgressionAnalysis[]>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const analyses: ArcProgressionAnalysis[] = [];

      for (const charId of input.characters) {
        const character = context.characterBibles[charId];
        if (!character) {
          analyses.push(this.createEmptyAnalysis(charId, 'Character not found in bible'));
          continue;
        }

        const analysis = this.analyzeArcProgression(character, input, context, cfg);
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
   * Create empty analysis for characters without arc data
   */
  private createEmptyAnalysis(characterId: string, reason: string): ArcProgressionAnalysis {
    return {
      characterId,
      currentStage: 'unknown',
      stageProgress: 0,
      scenesInStage: 0,
      overallProgress: 0,
      completedMilestones: [],
      pendingMilestones: [],
      issues: [{
        type: 'arc-incomplete',
        severity: 'low',
        description: reason,
        suggestion: 'Define character arc in profile',
      }],
      recommendations: [],
    };
  }

  /**
   * Analyze character arc progression
   */
  private analyzeArcProgression(
    character: CharacterProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    cfg: ArcProgressionConfig
  ): ArcProgressionAnalysis {
    const issues: ArcIssue[] = [];
    const recommendations: string[] = [];

    // Get arc from character profile
    const arc = character.arc;
    if (!arc) {
      return this.createEmptyAnalysis(character.id, 'No arc defined in character profile');
    }

    // Determine current stage based on scene number and episode context
    const currentStage = this.determineCurrentStage(input, context, cfg.stages);
    const stageConfig = cfg.stages.find(s => s.name === currentStage);
    
    if (!stageConfig) {
      issues.push({
        type: 'arc-incomplete',
        severity: 'high',
        description: `Current stage "${currentStage}" not found in configuration`,
        suggestion: 'Check arc stage configuration',
      });
      return this.createEmptyAnalysis(character.id, 'Invalid stage configuration');
    }

    // Get scenes in current stage from context
    const scenesInStage = this.getScenesInStage(character.id, currentStage, context);
    const stageProgress = Math.min(1, scenesInStage / cfg.minScenesPerStage);

    // Check milestones
    const { completed, pending } = this.checkMilestones(character, input, context, stageConfig);

    // Calculate overall progress
    const stageOrder = stageConfig.order;
    const totalStages = cfg.stages.length;
    const overallProgress = (stageOrder - 1 + stageProgress) / totalStages;

    // Detect issues
    if (cfg.enforceTransitions) {
      this.detectTransitionIssues(character, input, context, cfg.stages, issues);
    }

    this.detectStalledStage(scenesInStage, cfg.minScenesPerStage, currentStage, issues);
    this.detectMissingMilestones(pending, stageConfig, issues);
    this.detectEmotionalInconsistency(character, input, stageConfig, issues);

    // Generate recommendations
    if (stageProgress < 0.5 && scenesInStage >= cfg.minScenesPerStage) {
      recommendations.push(`Advance ${character.name} to next arc stage`);
    }
    if (pending.length > 0) {
      recommendations.push(`Address pending milestones: ${pending.join(', ')}`);
    }
    if (overallProgress > 0.8 && currentStage !== 'resolution') {
      recommendations.push('Consider moving toward resolution stage');
    }

    return {
      characterId: character.id,
      currentStage,
      stageProgress,
      scenesInStage,
      overallProgress,
      completedMilestones: completed,
      pendingMilestones: pending,
      issues,
      recommendations: [...new Set(recommendations)],
    };
  }

  /**
   * Determine current arc stage based on scene/episode position
   */
  private determineCurrentStage(
    input: SceneGenerationInput,
    context: SkillContext,
    stages: ArcStage[]
  ): string {
    // Use episode structure if available
    if (context.episodeStructure) {
      const episode = context.episodeStructure;
      const scenePosition = input.sceneNumber / (episode.scenes.length || 1);
      
      // Map scene position to arc stage
      if (scenePosition < 0.2) return 'setup';
      if (scenePosition < 0.4) return 'inciting';
      if (scenePosition < 0.7) return 'rising';
      if (scenePosition < 0.9) return 'climax';
      return 'resolution';
    }

    // Fallback: use scene type
    const typeToStage: Record<string, string> = {
      exposition: 'setup',
      dialogue: 'rising',
      action: 'rising',
      climax: 'climax',
      resolution: 'resolution',
      transition: 'inciting',
    };
    return typeToStage[input.type] || 'rising';
  }

  /**
   * Get number of scenes character has been in current stage
   */
  private getScenesInStage(
    characterId: string,
    stage: string,
    context: SkillContext
  ): number {
    // In a real implementation, this would query a database of previous scenes
    // For now, estimate based on previous scenes in context
    if (!context.previousScenes) return 1;
    
    // Count scenes where character appeared
    return context.previousScenes.filter(scene => 
      scene.characters.includes(characterId)
    ).length + 1; // +1 for current scene
  }

  /**
   * Check which milestones are completed/pending
   */
  private checkMilestones(
    character: CharacterProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    stageConfig: ArcStage
  ): { completed: string[]; pending: string[] } {
    const completed: string[] = [];
    const pending: string[] = [];

    // Check current scene beats for milestone completion
    const currentBeats = input.keyBeats.join(' ').toLowerCase();
    
    for (const milestone of stageConfig.milestones) {
      const milestoneKeywords = this.getMilestoneKeywords(milestone);
      const found = milestoneKeywords.some(kw => currentBeats.includes(kw.toLowerCase()));
      
      if (found) {
        completed.push(milestone);
      } else {
        pending.push(milestone);
      }
    }

    // Also check previous scenes for completed milestones
    if (context.previousScenes) {
      // In real implementation, would check previous scene content
    }

    return { completed, pending };
  }

  /**
   * Get keywords associated with a milestone
   */
  private getMilestoneKeywords(milestone: string): string[] {
    const keywords: Record<string, string[]> = {
      'introduction': ['introduce', 'meet', 'first', 'arrive'],
      'status-quo': ['normal', 'routine', 'everyday', 'usual'],
      'inciting-incident': ['incident', 'event', 'happens', 'disrupts', 'changes'],
      'initial-reaction': ['react', 'respond', 'shock', 'surprise', 'confused'],
      'first-challenge': ['challenge', 'test', 'obstacle', 'problem', 'difficulty'],
      'failure': ['fail', 'lose', 'defeat', 'mistake', 'wrong'],
      'adaptation': ['adapt', 'learn', 'change', 'grow', 'improve', 'new approach'],
      'ultimate-challenge': ['final', 'ultimate', 'biggest', 'greatest', 'everything'],
      'critical-choice': ['choose', 'decide', 'decision', 'choice', 'must'],
      'aftermath': ['after', 'consequence', 'result', 'outcome', 'settles'],
      'new-equilibrium': ['new normal', 'changed', 'different', 'growth', 'evolved'],
    };
    return keywords[milestone] || [milestone];
  }

  /**
   * Detect transition issues
   */
  private detectTransitionIssues(
    character: CharacterProfile,
    input: SceneGenerationInput,
    context: SkillContext,
    stages: ArcStage[],
    issues: ArcIssue[]
  ): void {
    if (!context.previousScenes || context.previousScenes.length === 0) return;

    // Check if stage jumped more than one
    const previousStage = this.determineCurrentStage(
      { ...input, sceneNumber: input.sceneNumber - 1 } as SceneGenerationInput,
      context,
      stages
    );
    const currentStage = this.determineCurrentStage(input, context, stages);
    
    const prevOrder = stages.find(s => s.name === previousStage)?.order || 0;
    const currOrder = stages.find(s => s.name === currentStage)?.order || 0;
    
    if (currOrder > prevOrder + 1) {
      issues.push({
        type: 'stage-skipped',
        severity: 'high',
        sceneNumber: input.sceneNumber,
        description: `Arc stage jumped from ${previousStage} to ${currentStage} (skipped ${currOrder - prevOrder - 1} stage(s))`,
        suggestion: 'Add intermediate scenes to bridge arc stages',
      });
    }
  }

  /**
   * Detect if character is stalled in a stage
   */
  private detectStalledStage(
    scenesInStage: number,
    minScenes: number,
    stage: string,
    issues: ArcIssue[]
  ): void {
    if (scenesInStage > minScenes * 2) {
      issues.push({
        type: 'stage-stalled',
        severity: 'medium',
        description: `Character has been in ${stage} stage for ${scenesInStage} scenes (min: ${minScenes})`,
        suggestion: 'Advance character arc or add milestone-completing beats',
      });
    }
  }

  /**
   * Detect missing milestones
   */
  private detectMissingMilestones(
    pending: string[],
    stageConfig: ArcStage,
    issues: ArcIssue[]
  ): void {
    if (pending.length === stageConfig.milestones.length && pending.length > 0) {
      issues.push({
        type: 'milestone-missing',
        severity: 'medium',
        description: `No milestones completed for ${stageConfig.name} stage`,
        suggestion: `Include beats for: ${pending.join(', ')}`,
      });
    }
  }

  /**
   * Detect emotional inconsistency with arc stage
   */
  private detectEmotionalInconsistency(
    character: CharacterProfile,
    input: SceneGenerationInput,
    stageConfig: ArcStage,
    issues: ArcIssue[]
  ): void {
    // Check dialogue tone against expected emotional range
    // This would integrate with VoiceConsistency results
    // For now, basic check on scene type vs stage
    const expectedEmotions = stageConfig.emotionalRange;
    const sceneType = input.type;
    
    const mismatched: Record<string, string[]> = {
      setup: ['angry', 'furious', 'desperate'],
      inciting: ['peaceful', 'confident', 'resolute'],
      climax: ['neutral', 'content', 'bored'],
    };
    
    const avoidEmotions = mismatched[stageConfig.name] || [];
    // This would need actual dialogue tone analysis
  }
}

/**
 * Factory for creating ArcProgression
 */
export async function createArcProgression(
  config?: Partial<ArcProgressionConfig>
): Promise<ArcProgression> {
  const skill = new ArcProgression();
  await skill.initialize(config);
  return skill;
}