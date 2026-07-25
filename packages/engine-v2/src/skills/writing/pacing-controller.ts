/**
 * Suro-Buya Engine v2 - Pacing Controller Skill
 * 
 * Controls narrative pacing and rhythm within scenes and across episodes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { WritingSkill } from '../base.js';
import type { SceneGenerationInput, EpisodeGenerationInput } from '../../types.js';

/**
 * Pacing Controller configuration
 */
export interface PacingControllerConfig extends Record<string, unknown> {
  /** Target scene duration in minutes */
  targetSceneDuration: number;
  /** Pacing profile: slow-burn, steady, fast, variable */
  pacingProfile: 'slow-burn' | 'steady' | 'fast' | 'variable';
  /** Whether to adjust beat timing */
  adjustBeatTiming: boolean;
  /** Minimum beat duration (seconds) */
  minBeatDuration: number;
  /** Maximum beat duration (seconds) */
  maxBeatDuration: number;
}

/**
 * Beat timing information
 */
export interface BeatTiming {
  /** Beat index */
  beatIndex: number;
  /** Estimated duration in seconds */
  durationSeconds: number;
  /** Pacing intensity: low, medium, high */
  intensity: 'low' | 'medium' | 'high';
  /** Transition type to next beat */
  transition: 'cut' | 'dissolve' | 'fade' | 'smash' | 'match';
}

/**
 * Pacing analysis result
 */
export interface PacingAnalysis {
  /** Overall scene pacing score (0-1) */
  pacingScore: number;
  /** Beat timings */
  beatTimings: BeatTiming[];
  /** Total estimated duration */
  totalDurationSeconds: number;
  /** Pacing issues detected */
  issues: PacingIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Pacing issue
 */
export interface PacingIssue {
  /** Issue type */
  type: 'too-fast' | 'too-slow' | 'uneven' | 'missing-beats' | 'rushed-ending';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Beat index where issue occurs */
  beatIndex?: number;
  /** Description */
  description: string;
  /** Suggestion to fix */
  suggestion: string;
}

/**
 * Pacing Controller Skill
 * Analyzes and controls narrative pacing
 */
export class PacingController extends WritingSkill<SceneGenerationInput, PacingAnalysis> {
  override name = 'PacingController';
  override version = '1.0.0';
  override description = 'Analyzes and controls narrative pacing within scenes';
  override dependencies: string[] = ['ScreenplayFormatter', 'ActionWriter'];
  override required = false;
  
  override configSchema = z.object({
    targetSceneDuration: z.number().default(3),
    pacingProfile: z.enum(['slow-burn', 'steady', 'fast', 'variable']).default('steady'),
    adjustBeatTiming: z.boolean().default(true),
    minBeatDuration: z.number().default(15),
    maxBeatDuration: z.number().default(120),
  });

  override defaultConfig: Record<string, unknown> = {
    targetSceneDuration: 3,
    pacingProfile: 'steady',
    adjustBeatTiming: true,
    minBeatDuration: 15,
    maxBeatDuration: 120,
  };

  protected override config: PacingControllerConfig = {
    targetSceneDuration: 3,
    pacingProfile: 'steady',
    adjustBeatTiming: true,
    minBeatDuration: 15,
    maxBeatDuration: 120,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<PacingAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const beatTimings = this.calculateBeatTimings(input, cfg);
      const totalDuration = beatTimings.reduce((sum, bt) => sum + bt.durationSeconds, 0);
      const pacingScore = this.calculatePacingScore(beatTimings, input, cfg);
      const issues = this.detectPacingIssues(beatTimings, input, cfg);
      const recommendations = this.generateRecommendations(issues, beatTimings, input, cfg);

      const analysis: PacingAnalysis = {
        pacingScore,
        beatTimings,
        totalDurationSeconds: totalDuration,
        issues,
        recommendations,
      };

      return {
        success: true,
        data: analysis,
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
   * Calculate timing for each beat based on scene type and pacing profile
   */
  private calculateBeatTimings(input: SceneGenerationInput, cfg: PacingControllerConfig): BeatTiming[] {
    const beatCount = input.keyBeats.length;
    const targetTotalSeconds = cfg.targetSceneDuration * 60;
    const baseDuration = targetTotalSeconds / beatCount;
    
    const timings: BeatTiming[] = [];
    
    for (let i = 0; i < beatCount; i++) {
      const position = i / (beatCount - 1) || 0; // 0 to 1
      let duration = baseDuration;
      let intensity: 'low' | 'medium' | 'high' = 'medium';
      let transition: BeatTiming['transition'] = 'cut';

      // Adjust based on pacing profile
      switch (cfg.pacingProfile) {
        case 'slow-burn':
          duration *= this.getSlowBurnMultiplier(position);
          intensity = position < 0.7 ? 'low' : position < 0.9 ? 'medium' : 'high';
          transition = position > 0.8 ? 'dissolve' : 'cut';
          break;
        case 'fast':
          duration *= this.getFastMultiplier(position);
          intensity = position < 0.3 ? 'high' : position < 0.7 ? 'medium' : 'high';
          transition = position > 0.5 ? 'smash' : 'cut';
          break;
        case 'variable':
          duration *= this.getVariableMultiplier(position, input.type);
          intensity = this.getVariableIntensity(position, input.type);
          transition = this.getVariableTransition(position, input.type);
          break;
        case 'steady':
        default:
          duration *= 1.0;
          intensity = position < 0.5 ? 'medium' : position < 0.8 ? 'medium' : 'high';
          transition = 'cut';
          break;
      }

      // Adjust for scene type
      duration = this.adjustForSceneType(duration, input.type, position);
      
      // Clamp to min/max
      duration = Math.max(cfg.minBeatDuration, Math.min(cfg.maxBeatDuration, duration));

      // Special handling for first and last beats
      if (i === 0) {
        duration *= 1.2; // Opening beat slightly longer
        intensity = 'low';
      } else if (i === beatCount - 1) {
        duration *= 0.8; // Closing beat shorter
        intensity = 'high';
        transition = input.type === 'resolution' ? 'fade' : 'cut';
      }

      timings.push({
        beatIndex: i,
        durationSeconds: Math.round(duration),
        intensity,
        transition,
      });
    }

    return timings;
  }

  /**
   * Get multiplier for slow-burn pacing
   */
  private getSlowBurnMultiplier(position: number): number {
    // Starts slow, gradually accelerates
    return 0.7 + (position * 0.8);
  }

  /**
   * Get multiplier for fast pacing
   */
  private getFastMultiplier(position: number): number {
    // Starts fast, maintains high tempo
    return 0.5 + (position * 0.3);
  }

  /**
   * Get multiplier for variable pacing based on scene type
   */
  private getVariableMultiplier(position: number, sceneType: SceneGenerationInput['type']): number {
    const curves: Record<SceneGenerationInput['type'], (p: number) => number> = {
      action: (p) => 0.6 + Math.sin(p * Math.PI) * 0.4, // Wave pattern
      dialogue: (p) => 0.8 + p * 0.4, // Gradual increase
      exposition: (p) => 1.0, // Steady
      climax: (p) => 0.5 + p * 1.0, // Steep increase
      resolution: (p) => 1.2 - p * 0.6, // Decrease
      transition: (p) => 0.7 + p * 0.3, // Slight increase
    };
    return curves[sceneType] ? curves[sceneType](position) : 1.0;
  }

  /**
   * Get intensity for variable pacing
   */
  private getVariableIntensity(position: number, sceneType: SceneGenerationInput['type']): 'low' | 'medium' | 'high' {
    if (sceneType === 'climax') {
      return position < 0.3 ? 'medium' : position < 0.7 ? 'high' : 'high';
    }
    if (sceneType === 'action') {
      return position < 0.4 ? 'medium' : 'high';
    }
    if (sceneType === 'resolution') {
      return position < 0.5 ? 'medium' : 'low';
    }
    return position < 0.5 ? 'low' : 'medium';
  }

  /**
   * Get transition for variable pacing
   */
  private getVariableTransition(position: number, sceneType: SceneGenerationInput['type']): BeatTiming['transition'] {
    if (sceneType === 'climax' && position > 0.6) return 'smash';
    if (sceneType === 'action' && position > 0.5) return 'cut';
    if (sceneType === 'resolution' && position > 0.7) return 'fade';
    return 'cut';
  }

  /**
   * Adjust duration based on scene type
   */
  private adjustForSceneType(duration: number, sceneType: SceneGenerationInput['type'], position: number): number {
    const modifiers: Record<SceneGenerationInput['type'], number> = {
      action: 0.8,
      dialogue: 1.3,
      exposition: 1.2,
      climax: 0.7,
      resolution: 1.1,
      transition: 0.9,
    };
    return duration * (modifiers[sceneType] || 1.0);
  }

  /**
   * Calculate overall pacing score
   */
  private calculatePacingScore(timings: BeatTiming[], input: SceneGenerationInput, cfg: PacingControllerConfig): number {
    let score = 1.0;
    const targetTotal = cfg.targetSceneDuration * 60;
    const actualTotal = timings.reduce((sum, t) => sum + t.durationSeconds, 0);
    
    // Penalize for total duration mismatch
    const durationRatio = actualTotal / targetTotal;
    if (durationRatio < 0.7 || durationRatio > 1.3) {
      score -= 0.2;
    }

    // Check for pacing consistency
    const durations = timings.map(t => t.durationSeconds);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const cv = Math.sqrt(variance) / avgDuration; // Coefficient of variation
    
    if (cv > 0.5 && cfg.pacingProfile !== 'variable') {
      score -= 0.15; // Too uneven for non-variable profile
    }

    // Check intensity progression
    const intensities = timings.map(t => t.intensity === 'low' ? 1 : t.intensity === 'medium' ? 2 : 3);
    const expectedProgression = this.getExpectedIntensityProgression(input.type, timings.length);
    let intensityMatch = 0;
    for (let i = 0; i < intensities.length; i++) {
      const expected = expectedProgression[i];
      const intensity = intensities[i];
      if (expected !== undefined && intensity !== undefined && intensity >= expected) intensityMatch++;
    }
    const intensityScore = intensities.length > 0 ? intensityMatch / intensities.length : 1;
    if (intensityScore < 0.6) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get expected intensity progression for scene type
   */
  private getExpectedIntensityProgression(sceneType: SceneGenerationInput['type'], length: number): number[] {
    const progressions: Record<SceneGenerationInput['type'], number[]> = {
      action: Array.from({ length }, (_, i) => i / length * 2 + 1),
      dialogue: Array.from({ length }, (_, i) => i < length * 0.5 ? 1 : 2),
      exposition: Array.from({ length }, () => 1),
      climax: Array.from({ length }, (_, i) => i / length * 2 + 1),
      resolution: Array.from({ length }, (_, i) => 3 - i / length * 2),
      transition: Array.from({ length }, (_, i) => 1 + i / length),
    };
    return progressions[sceneType] || Array.from({ length }, () => 2);
  }

  /**
   * Detect pacing issues
   */
  private detectPacingIssues(timings: BeatTiming[], input: SceneGenerationInput, cfg: PacingControllerConfig): PacingIssue[] {
    const issues: PacingIssue[] = [];
    const durations = timings.map(t => t.durationSeconds);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const targetTotal = cfg.targetSceneDuration * 60;

    // Too fast overall
    if (totalDuration < targetTotal * 0.7) {
      issues.push({
        type: 'too-fast',
        severity: 'high',
        description: `Scene runs ${Math.round(totalDuration/60)} min, target is ${cfg.targetSceneDuration} min`,
        suggestion: 'Add more beats, expand action descriptions, or increase dialogue',
      });
    }

    // Too slow overall
    if (totalDuration > targetTotal * 1.3) {
      issues.push({
        type: 'too-slow',
        severity: 'medium',
        description: `Scene runs ${Math.round(totalDuration/60)} min, target is ${cfg.targetSceneDuration} min`,
        suggestion: 'Combine beats, trim descriptions, or increase pacing profile',
      });
    }

    // Uneven pacing
    const avgDuration = durations.length > 0 ? totalDuration / durations.length : 0;
    for (let i = 0; i < durations.length; i++) {
      const duration = durations[i];
      if (duration === undefined) continue;
      const ratio = duration / avgDuration;
      if (ratio > 2.5) {
        issues.push({
          type: 'uneven',
          severity: 'medium',
          beatIndex: i,
          description: `Beat ${i + 1} is ${ratio.toFixed(1)}x longer than average`,
          suggestion: 'Split long beat or expand surrounding beats',
        });
      } else if (ratio < 0.4) {
        issues.push({
          type: 'uneven',
          severity: 'low',
          beatIndex: i,
          description: `Beat ${i + 1} is very short (${ratio.toFixed(1)}x average)`,
          suggestion: 'Consider merging with adjacent beat or expanding',
        });
      }
    }

    // Rushed ending
    const lastBeat = timings[timings.length - 1];
    const secondLastBeat = timings.length >= 2 ? timings[timings.length - 2] : undefined;
    if (secondLastBeat && lastBeat && lastBeat.durationSeconds < secondLastBeat.durationSeconds * 0.5) {
      issues.push({
        type: 'rushed-ending',
        severity: 'medium',
        beatIndex: timings.length - 1,
        description: 'Final beat significantly shorter than penultimate beat',
        suggestion: 'Extend final beat for proper resolution',
      });
    }

    // Missing beats for complex scenes
    if (input.type === 'climax' && input.keyBeats.length < 3) {
      issues.push({
        type: 'missing-beats',
        severity: 'high',
        description: 'Climax scene has fewer than 3 beats',
        suggestion: 'Add more beats to build proper climax structure',
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(
    issues: PacingIssue[],
    timings: BeatTiming[],
    input: SceneGenerationInput,
    cfg: PacingControllerConfig
  ): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'too-fast')) {
      recommendations.push('Consider adding transitional beats between major story points');
      recommendations.push('Expand action descriptions with sensory details');
    }

    if (issues.some(i => i.type === 'too-slow')) {
      recommendations.push('Increase pacing profile to "fast" or "variable"');
      recommendations.push('Combine related beats into single stronger beats');
    }

    if (issues.some(i => i.type === 'uneven')) {
      recommendations.push('Redistribute beat durations for smoother flow');
      recommendations.push('Use "variable" pacing profile for natural rhythm');
    }

    if (issues.some(i => i.type === 'rushed-ending')) {
      recommendations.push('Extend final beat with resolution or cliffhanger');
      recommendations.push('Add epilogue beat for closure');
    }

    if (issues.some(i => i.type === 'missing-beats')) {
      recommendations.push(`Add ${3 - input.keyBeats.length} more beats to ${input.type} scene`);
    }

    // Profile-specific recommendations
    if (cfg.pacingProfile === 'steady' && input.type === 'action') {
      recommendations.push('Consider "fast" or "variable" profile for action scenes');
    }
    if (cfg.pacingProfile === 'fast' && input.type === 'exposition') {
      recommendations.push('Consider "steady" or "slow-burn" profile for exposition');
    }

    return [...new Set(recommendations)]; // Deduplicate
  }
}

/**
 * Factory for creating PacingController
 */
export async function createPacingController(
  config?: Partial<PacingControllerConfig>
): Promise<PacingController> {
  const skill = new PacingController();
  await skill.initialize(config);
  return skill;
}