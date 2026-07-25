/**
 * Suro-Buya Engine v2 - Shot Composer Skill
 * 
 * Composes cinematic shots and camera directions for scenes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CameraSkill } from '../base.js';
import type { SceneGenerationInput, CameraShot, ShotComposition } from '../../types.js';

/**
 * Shot Composer configuration
 */
export interface ShotComposerConfig extends Record<string, unknown> {
  /** Default shot duration (seconds) */
  defaultShotDuration: number;
  /** Preferred aspect ratio */
  aspectRatio: string;
  /** Enable dynamic camera movement */
  dynamicMovement: boolean;
  /** Shot variety level */
  variety: 'low' | 'medium' | 'high';
  /** Enforce 180-degree rule */
  enforce180Rule: boolean;
}

/**
 * Shot composition plan
 */
export interface ShotPlan {
  /** Scene number */
  sceneNumber: number;
  /** Shots in sequence */
  shots: CameraShot[];
  /** Total estimated duration */
  totalDuration: number;
  /** Camera setup notes */
  setupNotes: string[];
  /** Equipment needed */
  equipment: string[];
}

/**
 * Shot Composer analysis result
 */
export interface ShotCompositionAnalysis {
  /** Composed shot plan */
  shotPlan: ShotPlan;
  /** Shot breakdown by type */
  shotBreakdown: ShotBreakdown;
  /** Issues detected */
  issues: ShotIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Shot breakdown statistics
 */
export interface ShotBreakdown {
  /** Total shots */
  total: number;
  /** By shot size */
  bySize: Record<string, number>;
  /** By angle */
  byAngle: Record<string, number>;
  /** By movement */
  byMovement: Record<string, number>;
  /** Average duration */
  avgDuration: number;
}

/**
 * Shot issue
 */
export interface ShotIssue {
  /** Issue type */
  type: '180-rule-violation' | 'jump-cut-risk' | 'monotonous-pattern' | 'impossible-movement' | 'coverage-gap' | 'timing-issue';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Shot indices */
  shots: number[];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Shot Composer Skill
 * Composes cinematic shots for scenes
 */
export class ShotComposer extends CameraSkill<SceneGenerationInput, ShotCompositionAnalysis> {
  override name = 'ShotComposer';
  override version = '1.0.0';
  override description = 'Composes cinematic shots and camera directions for scenes';
  override dependencies: string[] = ['ContinuityGuard', 'VisualReferenceMatcher'];
  override required = false;
  
  override configSchema = z.object({
    defaultShotDuration: z.number().default(4),
    aspectRatio: z.string().default('16:9'),
    dynamicMovement: z.boolean().default(true),
    variety: z.enum(['low', 'medium', 'high']).default('medium'),
    enforce180Rule: z.boolean().default(true),
  });

  override defaultConfig: Record<string, unknown> = {
    defaultShotDuration: 4,
    aspectRatio: '16:9',
    dynamicMovement: true,
    variety: 'medium',
    enforce180Rule: true,
  };

  protected override config: ShotComposerConfig = {
    defaultShotDuration: 4,
    aspectRatio: '16:9',
    dynamicMovement: true,
    variety: 'medium',
    enforce180Rule: true,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<ShotCompositionAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const issues: ShotIssue[] = [];
      const recommendations: string[] = [];

      // Analyze scene beats to determine shot needs
      const shotPlan = this.composeShots(input, context, cfg);
      
      // Analyze shot breakdown
      const shotBreakdown = this.analyzeShotBreakdown(shotPlan.shots);
      
      // Check for issues
      if (cfg.enforce180Rule) {
        this.check180Rule(shotPlan.shots, issues);
      }
      this.checkJumpCuts(shotPlan.shots, issues);
      this.checkMonotonousPatterns(shotPlan.shots, issues);
      this.checkImpossibleMovements(shotPlan.shots, issues);
      this.checkCoverageGaps(shotPlan.shots, input, issues);
      this.checkTiming(shotPlan.shots, input, issues);

      // Generate recommendations
      if (shotBreakdown.bySize['closeup'] && shotBreakdown.bySize['closeup'] > shotPlan.shots.length * 0.5) {
        recommendations.push('Consider varying shot sizes - too many closeups');
      }
      if (shotBreakdown.byMovement['static'] && shotBreakdown.byMovement['static'] > shotPlan.shots.length * 0.7) {
        recommendations.push('Add more camera movement for visual interest');
      }
      if (issues.some(i => i.type === '180-rule-violation')) {
        recommendations.push('Establish clear line of action for 180-degree rule');
      }

      const analysis: ShotCompositionAnalysis = {
        shotPlan,
        shotBreakdown,
        issues,
        recommendations: [...new Set(recommendations)],
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
   * Compose shots for a scene
   */
  private composeShots(input: SceneGenerationInput, context: SkillContext, cfg: ShotComposerConfig): ShotPlan {
    const shots: CameraShot[] = [];
    const setupNotes: string[] = [];
    const equipment: string[] = ['camera', 'tripod'];
    
    let currentTime = 0;
    const beatDuration = this.calculateBeatDuration(input, cfg);

    // Determine shot pattern based on scene type
    const pattern = this.determineShotPattern(input, cfg.variety);

    // Generate shots for each beat
    for (let i = 0; i < input.keyBeats.length; i++) {
      const beat = input.keyBeats[i];
      if (!beat) continue;
      const beatShots = this.generateShotsForBeat(beat, i, input, context, pattern, cfg);
      
      for (const shot of beatShots) {
        shot.startTime = currentTime;
        shot.endTime = currentTime + shot.duration;
        currentTime = shot.endTime;
        shots.push(shot);
      }
    }

      // Add establishing shot if first scene or new location
      if (input.sceneNumber === 1 || this.isNewLocation(input, context)) {
        const establishingShot = this.createEstablishingShot(input, context);
        establishingShot.startTime = 0;
        establishingShot.endTime = establishingShot.duration;
        // Shift other shots
        shots.forEach(s => {
          s.startTime = (s.startTime ?? 0) + establishingShot.duration;
          s.endTime = (s.endTime ?? 0) + establishingShot.duration;
        });
        shots.unshift(establishingShot);
        currentTime += establishingShot.duration;
      }

    // Add coverage shots
    const coverageShots = this.generateCoverageShots(input, shots);
    shots.push(...coverageShots);

    // Add equipment based on shots
    this.determineEquipment(shots, equipment);

    // Generate setup notes
    this.generateSetupNotes(shots, input, setupNotes);

    return {
      sceneNumber: input.sceneNumber,
      shots,
      totalDuration: currentTime,
      setupNotes,
      equipment: [...new Set(equipment)],
    };
  }

  /**
   * Calculate beat duration
   */
  private calculateBeatDuration(input: SceneGenerationInput, cfg: ShotComposerConfig): number {
    const totalBeats = input.keyBeats.length;
    const estimatedSceneTime = totalBeats * cfg.defaultShotDuration * 2; // ~2 shots per beat
    return estimatedSceneTime / totalBeats;
  }

  /**
   * Determine shot pattern based on variety
   */
  private determineShotPattern(input: SceneGenerationInput, variety: ShotComposerConfig['variety']): string[] {
    const patterns = {
      low: ['medium', 'medium', 'closeup', 'medium'],
      medium: ['wide', 'medium', 'closeup', 'medium', 'wide', 'closeup'],
      high: ['extreme-wide', 'wide', 'medium', 'closeup', 'extreme-closeup', 'medium', 'wide', 'over-the-shoulder'],
    };
    return patterns[variety];
  }

  /**
   * Generate shots for a beat
   */
  private generateShotsForBeat(
    beat: string,
    beatIndex: number,
    input: SceneGenerationInput,
    context: SkillContext,
    pattern: string[],
    cfg: ShotComposerConfig
  ): CameraShot[] {
    const shots: CameraShot[] = [];
    const beatLower = beat.toLowerCase();
    const numShots = this.determineShotsPerBeat(beat, cfg.variety);
    
    for (let i = 0; i < numShots; i++) {
      const patternIndex = (beatIndex * numShots + i) % pattern.length;
      const shotSize = pattern[patternIndex] as CameraShot['size'];
      
      const angle = this.determineAngle(beat, shotSize, i);
      const movement = this.determineMovement(beat, shotSize, cfg.dynamicMovement);
      const duration = this.determineDuration(beat, shotSize, cfg.defaultShotDuration);
      const composition = this.determineComposition(beat, shotSize, input.characters.length);
      const focus = this.determineFocus(beat, input.characters, context);
      const description = this.generateShotDescription(beat, shotSize, angle, movement);
      
      const shot: CameraShot = {
        id: `shot_${input.sceneNumber}_${beatIndex}_${i}`,
        sceneNumber: input.sceneNumber,
        beatIndex,
        size: shotSize,
        angle,
        movement,
        duration,
        composition,
        focus,
        description,
        equipment: [],
      };

      shots.push(shot);
    }

    return shots;
  }

  /**
   * Determine shots per beat
   */
  private determineShotsPerBeat(beat: string, variety: ShotComposerConfig['variety']): number {
    const beatLower = beat.toLowerCase();
    
    // Action beats get more shots
    if (beatLower.includes('fight') || beatLower.includes('chase') || beatLower.includes('action')) {
      return variety === 'high' ? 4 : variety === 'medium' ? 3 : 2;
    }
    
    // Dialogue beats
    if (beatLower.includes('talk') || beatLower.includes('say') || beatLower.includes('discuss')) {
      return variety === 'high' ? 3 : 2;
    }
    
    // Emotional beats
    if (beatLower.includes('realize') || beatLower.includes('feel') || beatLower.includes('emotion')) {
      return 2;
    }
    
    return variety === 'high' ? 3 : 2;
  }

  /**
   * Determine camera angle
   */
  private determineAngle(beat: string, shotSize: string, shotIndex: number): CameraShot['angle'] {
    const beatLower = beat.toLowerCase();
    
    if (beatLower.includes('power') || beatLower.includes('dominat') || beatLower.includes('intimidat')) {
      return 'low';
    }
    if (beatLower.includes('vulnerab') || beatLower.includes('weak') || beatLower.includes('small')) {
      return 'high';
    }
    if (beatLower.includes('pov') || beatLower.includes('perspective') || beatLower.includes('see')) {
      return 'pov';
    }
    if (beatLower.includes('overhead') || beatLower.includes('top') || beatLower.includes('bird')) {
      return 'overhead';
    }
    if (beatLower.includes('dutch') || beatLower.includes('tilt') || beatLower.includes('uneasy')) {
      return 'dutch';
    }
    
    // Alternate angles for variety
    const angles: CameraShot['angle'][] = ['eye-level', 'low', 'high', 'eye-level'];
    return angles[shotIndex % angles.length] ?? 'eye-level';
  }

  /**
   * Determine camera movement
   */
  private determineMovement(beat: string, shotSize: string, dynamic: boolean): CameraShot['movement'] {
    if (!dynamic) return 'static';
    
    const beatLower = beat.toLowerCase();
    
    if (beatLower.includes('chase') || beatLower.includes('run') || beatLower.includes('follow')) {
      return 'tracking';
    }
    if (beatLower.includes('reveal') || beatLower.includes('discover') || beatLower.includes('show')) {
      return 'pan';
    }
    if (beatLower.includes('emotional') || beatLower.includes('intimate') || beatLower.includes('close')) {
      return 'push';
    }
    if (beatLower.includes('wide') || beatLower.includes('establish') || beatLower.includes('landscape')) {
      return 'crane';
    }
    if (shotSize === 'closeup' || shotSize === 'extreme-closeup') {
      return 'static'; // Usually static for closeups
    }
    
    const movements: CameraShot['movement'][] = ['static', 'pan', 'tilt', 'dolly'];
    return movements[Math.floor(Math.random() * movements.length)] ?? 'static';
  }

  /**
   * Determine shot duration
   */
  private determineDuration(beat: string, shotSize: string, defaultDuration: number): number {
    const beatLower = beat.toLowerCase();
    
    // Action = shorter shots
    if (beatLower.includes('action') || beatLower.includes('fight') || beatLower.includes('fast')) {
      return defaultDuration * 0.5;
    }
    
    // Emotional = longer shots
    if (beatLower.includes('emotion') || beatLower.includes('realize') || beatLower.includes('moment')) {
      return defaultDuration * 1.5;
    }
    
    // Closeups can be shorter
    if (shotSize === 'closeup' || shotSize === 'extreme-closeup') {
      return defaultDuration * 0.8;
    }
    
    // Wide shots longer
    if (shotSize === 'wide' || shotSize === 'extreme-wide') {
      return defaultDuration * 1.2;
    }
    
    return defaultDuration;
  }

  /**
   * Determine composition
   */
  private determineComposition(beat: string, shotSize: string, characterCount: number): ShotComposition {
    const beatLower = beat.toLowerCase();
    
    let rule: ShotComposition['ruleOfThirds'] = 'center';
    let depth: ShotComposition['depth'] = 'medium';
    let framing: ShotComposition['framing'] = 'single';
    
    if (characterCount === 1) {
      framing = 'single';
      rule = shotSize === 'closeup' ? 'center' : 'thirds';
    } else if (characterCount === 2) {
      framing = 'two-shot';
      rule = 'thirds';
    } else {
      framing = 'group';
      rule = 'center';
    }
    
    if (beatLower.includes('isolat') || beatLower.includes('alone') || beatLower.includes('lonely')) {
      framing = 'single';
      rule = 'center';
      depth = 'shallow';
    }
    
    if (beatLower.includes('environ') || beatLower.includes('world') || beatLower.includes('setting')) {
      depth = 'deep';
    }
    
    return { ruleOfThirds: rule, depth, framing };
  }

  /**
   * Determine focus
   */
  private determineFocus(beat: string, characters: string[], context: SkillContext): string {
    const beatLower = beat.toLowerCase();
    
    // Check for specific character focus
    for (const charId of characters) {
      const char = context.characterBibles[charId];
      if (char && beatLower.includes(char.name.toLowerCase())) {
        return char.name;
      }
    }
    
    // Check for object focus
    const objectKeywords = ['key', 'letter', 'weapon', 'photo', 'phone', 'book', 'door', 'window'];
    for (const kw of objectKeywords) {
      if (beatLower.includes(kw)) return kw;
    }
    
    // Default to first character or 'scene'
    return characters[0] ? context.characterBibles[characters[0]]?.name || 'scene' : 'scene';
  }

  /**
   * Generate shot description
   */
  private generateShotDescription(beat: string, size: string, angle: string, movement: string): string {
    const sizeDesc: Record<string, string> = {
      'extreme-wide': 'Extreme wide shot',
      'wide': 'Wide shot',
      'medium': 'Medium shot',
      'closeup': 'Close-up',
      'extreme-closeup': 'Extreme close-up',
      'over-the-shoulder': 'Over-the-shoulder shot',
    };
    
    const angleDesc: Record<string, string> = {
      'eye-level': 'at eye level',
      'low': 'from a low angle',
      'high': 'from a high angle',
      'overhead': 'from overhead',
      'dutch': 'with a Dutch tilt',
      'pov': 'from POV',
    };
    
    const moveDesc: Record<string, string> = {
      'static': 'static',
      'pan': 'panning',
      'tilt': 'tilting',
      'dolly': 'dollying',
      'tracking': 'tracking',
      'crane': 'crane shot',
      'push': 'pushing in',
      'pull': 'pulling back',
      'zoom': 'zooming',
    };
    
    return `${sizeDesc[size] || size} ${angleDesc[angle] || angle}, ${moveDesc[movement] || movement}. Beat: ${beat.substring(0, 100)}`;
  }

  /**
   * Create establishing shot
   */
  private createEstablishingShot(input: SceneGenerationInput, context: SkillContext): CameraShot {
    return {
      id: `shot_${input.sceneNumber}_establishing`,
      sceneNumber: input.sceneNumber,
      beatIndex: -1,
      size: 'extreme-wide',
      angle: 'eye-level',
      movement: 'crane',
      duration: 6,
      composition: { ruleOfThirds: 'thirds', depth: 'deep', framing: 'landscape' },
      focus: input.location,
      description: `Establishing shot of ${input.location}, ${input.timeOfDay}. Wide crane shot revealing setting.`,
      equipment: ['crane', 'wide-angle lens'],
    };
  }

  /**
   * Check if new location
   */
  private isNewLocation(input: SceneGenerationInput, context: SkillContext): boolean {
    // Simplified check
    return input.sceneNumber > 1;
  }

  /**
   * Generate coverage shots
   */
  private generateCoverageShots(input: SceneGenerationInput, mainShots: CameraShot[]): CameraShot[] {
    const coverage: CameraShot[] = [];
    const hasDialogue = input.keyBeats.some(b => b.toLowerCase().includes('talk') || b.toLowerCase().includes('say'));
    
    if (hasDialogue && input.characters.length >= 2) {
      // Add reverse shots for dialogue
      const charShots = mainShots.filter(s => s.size === 'closeup' || s.size === 'medium');
      for (let i = 0; i < Math.min(charShots.length, 2); i++) {
        const shot = charShots[i];
        if (shot) {
          coverage.push({
            ...shot,
            id: `${shot.id}_reverse`,
            angle: 'over-the-shoulder',
            description: `Reverse shot: ${shot.description}`,
          });
        }
      }
    }
    
    // Add cutaway if needed
    if (mainShots.length > 3) {
      coverage.push({
        id: `shot_${input.sceneNumber}_cutaway`,
        sceneNumber: input.sceneNumber,
        beatIndex: 0,
        size: 'medium',
        angle: 'eye-level',
        movement: 'static',
        duration: 2,
        composition: { ruleOfThirds: 'thirds', depth: 'medium', framing: 'single' },
        focus: 'detail',
        description: 'Cutaway to relevant detail or reaction',
        equipment: [],
      });
    }
    
    return coverage;
  }

  /**
   * Determine equipment needed
   */
  private determineEquipment(shots: CameraShot[], equipment: string[]): void {
    for (const shot of shots) {
      if (shot.movement === 'crane') equipment.push('crane');
      if (shot.movement === 'tracking') equipment.push('dolly', 'tracks');
      if (shot.movement === 'dolly') equipment.push('dolly');
      if (shot.size === 'extreme-wide' || shot.size === 'wide') equipment.push('wide-angle lens');
      if (shot.size === 'closeup' || shot.size === 'extreme-closeup') equipment.push('macro lens', 'follow focus');
      if (shot.angle === 'overhead') equipment.push('overhead rig');
    }
  }

  /**
   * Generate setup notes
   */
  private generateSetupNotes(shots: CameraShot[], input: SceneGenerationInput, notes: string[]): void {
    notes.push(`Scene ${input.sceneNumber}: ${input.location}, ${input.timeOfDay}`);
    notes.push(`Total shots: ${shots.length}`);
    
    const movements = [...new Set(shots.map(s => s.movement))];
    if (movements.length > 1) {
      notes.push(`Camera movements: ${movements.join(', ')}`);
    }
    
    const sizes = [...new Set(shots.map(s => s.size))];
    notes.push(`Shot sizes: ${sizes.join(', ')}`);
    
    if (shots.some(s => s.movement !== 'static')) {
      notes.push('Rehearse camera movements with actors');
    }
  }

  /**
   * Analyze shot breakdown
   */
  private analyzeShotBreakdown(shots: CameraShot[]): ShotBreakdown {
    const bySize: Record<string, number> = {};
    const byAngle: Record<string, number> = {};
    const byMovement: Record<string, number> = {};
    let totalDuration = 0;
    
    for (const shot of shots) {
      bySize[shot.size] = (bySize[shot.size] || 0) + 1;
      byAngle[shot.angle] = (byAngle[shot.angle] || 0) + 1;
      byMovement[shot.movement] = (byMovement[shot.movement] || 0) + 1;
      totalDuration += shot.duration;
    }
    
    return {
      total: shots.length,
      bySize,
      byAngle,
      byMovement,
      avgDuration: shots.length > 0 ? totalDuration / shots.length : 0,
    };
  }

  /**
   * Check 180-degree rule
   */
  private check180Rule(shots: CameraShot[], issues: ShotIssue[]): void {
    // Simplified check - in reality would need spatial tracking
    const angles = shots.map(s => s.angle);
    const hasLow = angles.includes('low');
    const hasHigh = angles.includes('high');
    const hasDutch = angles.includes('dutch');
    
    if (hasDutch && shots.length > 3) {
      // Check if dutch angle is justified
      const dutchShots = shots.filter(s => s.angle === 'dutch');
      for (const shot of dutchShots) {
        if (shot.beatIndex >= 0) {
          issues.push({
            type: '180-rule-violation',
            severity: 'low',
            shots: [shot.beatIndex],
            description: 'Dutch angle used - verify 180-degree rule maintained',
            suggestion: 'Ensure camera stays on one side of action line',
          });
        }
      }
    }
  }

  /**
   * Check jump cut risk
   */
  private checkJumpCuts(shots: CameraShot[], issues: ShotIssue[]): void {
    for (let i = 1; i < shots.length; i++) {
      const prev = shots[i - 1];
      const curr = shots[i];
      
      if (!prev || !curr) continue;
      
      // Same size and angle = jump cut risk
      if (prev.size === curr.size && prev.angle === curr.angle && prev.focus === curr.focus) {
        issues.push({
          type: 'jump-cut-risk',
          severity: 'medium',
          shots: [i - 1, i],
          description: `Potential jump cut: consecutive ${prev.size} shots at ${prev.angle}`,
          suggestion: 'Vary shot size/angle or add cutaway',
        });
      }
    }
  }

  /**
   * Check monotonous patterns
   */
  private checkMonotonousPatterns(shots: CameraShot[], issues: ShotIssue[]): void {
    // Check for repeating pattern
    if (shots.length >= 6) {
      const pattern = shots.slice(0, 3).map(s => s.size).join(',');
      const nextPattern = shots.slice(3, 6).map(s => s.size).join(',');
      
      if (pattern === nextPattern) {
        issues.push({
          type: 'monotonous-pattern',
          severity: 'low',
          shots: [0, 1, 2, 3, 4, 5],
          description: `Repeating shot pattern detected: ${pattern}`,
          suggestion: 'Vary shot sequence for visual interest',
        });
      }
    }
  }

  /**
   * Check impossible movements
   */
  private checkImpossibleMovements(shots: CameraShot[], issues: ShotIssue[]): void {
    for (let i = 1; i < shots.length; i++) {
      const prev = shots[i - 1];
      const curr = shots[i];
      
      if (!prev || !curr) continue;
      
      // Crane to crane instantly impossible
      if (prev.movement === 'crane' && curr.movement === 'crane' && curr.startTime! - prev.endTime! < 5) {
        issues.push({
          type: 'impossible-movement',
          severity: 'high',
          shots: [i - 1, i],
          description: 'Consecutive crane shots with insufficient reset time',
          suggestion: 'Add time for crane repositioning or use different movement',
        });
      }
      
      // Tracking to tracking opposite directions
      if (prev.movement === 'tracking' && curr.movement === 'tracking') {
        issues.push({
          type: 'impossible-movement',
          severity: 'medium',
          shots: [i - 1, i],
          description: 'Consecutive tracking shots may require dolly reset',
          suggestion: 'Allow time for dolly repositioning',
        });
      }
    }
  }

  /**
   * Check coverage gaps
   */
  private checkCoverageGaps(shots: CameraShot[], input: SceneGenerationInput, issues: ShotIssue[]): void {
    const hasCloseup = shots.some(s => s.size === 'closeup' || s.size === 'extreme-closeup');
    const hasWide = shots.some(s => s.size === 'wide' || s.size === 'extreme-wide');
    const hasMedium = shots.some(s => s.size === 'medium');
    
    if (!hasWide && shots.length > 2) {
      issues.push({
        type: 'coverage-gap',
        severity: 'medium',
        shots: [],
        description: 'No wide/establishing shot in scene',
        suggestion: 'Add establishing shot for spatial context',
      });
    }
    
    if (!hasCloseup && input.keyBeats.some(b => b.toLowerCase().includes('emotion'))) {
      issues.push({
        type: 'coverage-gap',
        severity: 'medium',
        shots: [],
        description: 'Emotional beats without closeup coverage',
        suggestion: 'Add closeups for emotional moments',
      });
    }
  }

  /**
   * Check timing
   */
  private checkTiming(shots: CameraShot[], input: SceneGenerationInput, issues: ShotIssue[]): void {
    const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
    const estimatedSceneTime = input.keyBeats.length * 30; // ~30 seconds per beat
    
    if (totalDuration > estimatedSceneTime * 2) {
      issues.push({
        type: 'timing-issue',
        severity: 'low',
        shots: [],
        description: `Shot plan duration (${totalDuration}s) exceeds estimated scene time (${estimatedSceneTime}s)`,
        suggestion: 'Reduce shot durations or combine shots',
      });
    }
    
    if (totalDuration < estimatedSceneTime * 0.3) {
      issues.push({
        type: 'timing-issue',
        severity: 'low',
        shots: [],
        description: `Shot plan duration (${totalDuration}s) may be too short for scene`,
        suggestion: 'Add more coverage or longer shots',
      });
    }
  }
}

/**
 * Factory for creating ShotComposer
 */
export async function createShotComposer(
  config?: Partial<ShotComposerConfig>
): Promise<ShotComposer> {
  const skill = new ShotComposer();
  await skill.initialize(config);
  return skill;
}