/**
 * Suro-Buya Engine v2 - Storyboard Generator Skill
 * 
 * Generates storyboard descriptions from shot compositions.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CameraSkill } from '../base.js';
import type { SceneGenerationInput, CameraShot, ShotPlan } from '../../types.js';

/**
 * Storyboard Generator configuration
 */
export interface StoryboardGeneratorConfig extends Record<string, unknown> {
  /** Include detailed panel descriptions */
  detailedPanels: boolean;
  /** Include camera direction notes */
  includeCameraNotes: boolean;
  /** Include lighting notes */
  includeLightingNotes: boolean;
  /** Include character blocking notes */
  includeBlockingNotes: boolean;
  /** Output format */
  format: 'text' | 'json' | 'markdown' | 'script';
  /** Panels per beat */
  panelsPerBeat: number;
}

/**
 * Storyboard panel
 */
export interface StoryboardPanel {
  /** Panel number */
  panel: number;
  /** Shot reference */
  shotId: string;
  /** Visual description */
  visual: string;
  /** Camera direction */
  camera?: string;
  /** Lighting direction */
  lighting?: string;
  /** Character blocking */
  blocking?: string;
  /** Dialogue/sound cues */
  audio?: string;
  /** Duration */
  duration: number;
  /** Transition to next */
  transition?: string;
}

/**
 * Storyboard sequence
 */
export interface StoryboardSequence {
  /** Scene number */
  sceneNumber: number;
  /** Scene slugline */
  slugline: string;
  /** Panels in sequence */
  panels: StoryboardPanel[];
  /** Total panels */
  totalPanels: number;
  /** Estimated duration */
  estimatedDuration: number;
  /** Notes */
  notes: string[];
}

/**
 * Storyboard analysis result
 */
export interface StoryboardAnalysis {
  /** Generated storyboard */
  storyboard: StoryboardSequence;
  /** Shot plan reference */
  shotPlan: ShotPlan;
  /** Issues */
  issues: StoryboardIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Storyboard issue
 */
export interface StoryboardIssue {
  /** Issue type */
  type: 'missing-coverage' | 'unclear-visual' | 'timing-mismatch' | 'transition-gap' | 'blocking-conflict';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Panel numbers */
  panels: number[];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Storyboard Generator Skill
 * Generates storyboard descriptions from shot compositions
 */
export class StoryboardGenerator extends CameraSkill<SceneGenerationInput, StoryboardAnalysis> {
  override name = 'StoryboardGenerator';
  override version = '1.0.0';
  override description = 'Generates storyboard descriptions from shot compositions';
  override dependencies: string[] = ['ShotComposer', 'VisualLanguageEnforcer'];
  override required = false;
  
  override configSchema = z.object({
    detailedPanels: z.boolean().default(true),
    includeCameraNotes: z.boolean().default(true),
    includeLightingNotes: z.boolean().default(true),
    includeBlockingNotes: z.boolean().default(true),
    format: z.enum(['text', 'json', 'markdown', 'script']).default('markdown'),
    panelsPerBeat: z.number().min(1).max(5).default(2),
  });

  override defaultConfig: Record<string, unknown> = {
    detailedPanels: true,
    includeCameraNotes: true,
    includeLightingNotes: true,
    includeBlockingNotes: true,
    format: 'markdown',
    panelsPerBeat: 2,
  };

  protected override config: StoryboardGeneratorConfig = {
    detailedPanels: true,
    includeCameraNotes: true,
    includeLightingNotes: true,
    includeBlockingNotes: true,
    format: 'markdown',
    panelsPerBeat: 2,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<StoryboardAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const issues: StoryboardIssue[] = [];
      const recommendations: string[] = [];

      // Get shot plan from context (would be provided by ShotComposer)
      const shotPlan = this.getShotPlanFromContext(context, input);
      
      // Generate storyboard
      const storyboard = this.generateStoryboard(input, shotPlan, context, cfg);
      
      // Validate storyboard
      this.validateStoryboard(storyboard, shotPlan, issues);
      
      // Generate recommendations
      if (issues.some(i => i.type === 'missing-coverage')) {
        recommendations.push('Add panels for missing shot coverage');
      }
      if (issues.some(i => i.type === 'unclear-visual')) {
        recommendations.push('Clarify visual descriptions in panels');
      }
      if (storyboard.panels.length < input.keyBeats.length * cfg.panelsPerBeat) {
        recommendations.push('Consider more panels per beat for complex scenes');
      }

      const analysis: StoryboardAnalysis = {
        storyboard,
        shotPlan,
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
   * Get shot plan from context or generate basic one
   */
  private getShotPlanFromContext(context: SkillContext, input: SceneGenerationInput): ShotPlan {
    // In real implementation, would retrieve from SkillContext shared data
    // For now, generate a basic shot plan
    return this.generateBasicShotPlan(input);
  }

  /**
   * Generate basic shot plan
   */
  private generateBasicShotPlan(input: SceneGenerationInput): ShotPlan {
    const shots: CameraShot[] = [];
    let currentTime = 0;
    
    // Establishing shot
    if (input.sceneNumber === 1) {
      const estShot: CameraShot = {
        id: `shot_${input.sceneNumber}_est`,
        sceneNumber: input.sceneNumber,
        beatIndex: -1,
        size: 'extreme-wide',
        angle: 'eye-level',
        movement: 'crane',
        duration: 5,
        composition: { ruleOfThirds: 'thirds', depth: 'deep', framing: 'landscape' },
        focus: input.location,
        description: `Establishing shot of ${input.location}`,
        equipment: ['crane', 'wide-angle lens'],
        startTime: 0,
        endTime: 5,
      };
      shots.push(estShot);
      currentTime = 5;
    }

    // Shots for each beat
    for (let i = 0; i < input.keyBeats.length; i++) {
      const beat = input.keyBeats[i] ?? '';
      const numShots = 2;
      
      for (let j = 0; j < numShots; j++) {
        const size = j === 0 ? 'wide' : 'closeup';
        const shot: CameraShot = {
          id: `shot_${input.sceneNumber}_${i}_${j}`,
          sceneNumber: input.sceneNumber,
          beatIndex: i,
          size: size as CameraShot['size'],
          angle: 'eye-level',
          movement: j === 0 ? 'pan' : 'static',
          duration: 4,
          composition: { ruleOfThirds: 'thirds', depth: 'medium', framing: 'single' },
          focus: input.characters[0] || 'scene',
          description: `${size} shot for beat: ${beat.substring(0, 50)}`,
          equipment: [],
          startTime: currentTime,
          endTime: currentTime + 4,
        };
        shots.push(shot);
        currentTime += 4;
      }
    }

    return {
      id: `plan_${input.sceneNumber}`,
      sceneNumber: input.sceneNumber,
      shots,
      totalDuration: currentTime,
      setupNotes: [`Scene ${input.sceneNumber}: ${input.location}, ${input.timeOfDay}`],
    };
  }

  /**
   * Generate storyboard from shot plan
   */
  private generateStoryboard(
    input: SceneGenerationInput,
    shotPlan: ShotPlan,
    context: SkillContext,
    cfg: StoryboardGeneratorConfig
  ): StoryboardSequence {
    const panels: StoryboardPanel[] = [];
    let panelNum = 1;

    // Generate slugline
    const slugline = this.generateSlugline(input);

    // Create panels for each shot
    for (const shot of shotPlan.shots) {
      const beat = shot.beatIndex >= 0 ? (input.keyBeats[shot.beatIndex] ?? 'Beat') : 'Establishing shot';
      const numPanels = shot.beatIndex >= 0 ? cfg.panelsPerBeat : 1;
      
      for (let p = 0; p < numPanels; p++) {
        const panel: StoryboardPanel = {
          panel: panelNum++,
          shotId: shot.id,
          visual: this.generateVisualDescription(shot, beat, input, context, p, numPanels),
          duration: shot.duration / numPanels,
        };

        if (cfg.includeCameraNotes) {
          panel.camera = this.generateCameraNote(shot);
        }
        if (cfg.includeLightingNotes) {
          panel.lighting = this.generateLightingNote(shot, input);
        }
        if (cfg.includeBlockingNotes) {
          panel.blocking = this.generateBlockingNote(shot, input, context);
        }
        if (p === numPanels - 1 && shot !== shotPlan.shots[shotPlan.shots.length - 1]) {
          const nextShot = shotPlan.shots[shotPlan.shots.indexOf(shot) + 1];
          if (nextShot) {
            panel.transition = this.determineTransition(shot, nextShot);
          }
        }
        
        // Audio cues
        if (shot.beatIndex >= 0) {
          panel.audio = this.generateAudioCue(beat, shot, input);
        }

        panels.push(panel);
      }
    }

    const notes = [
      `Scene ${input.sceneNumber}: ${input.location} - ${input.timeOfDay}`,
      `Characters: ${input.characters.map(c => context.characterBibles[c]?.name || c).join(', ')}`,
      `Total panels: ${panels.length}`,
      `Estimated duration: ${shotPlan.totalDuration} seconds`,
      ...shotPlan.setupNotes,
    ];

    return {
      sceneNumber: input.sceneNumber,
      slugline,
      panels,
      totalPanels: panels.length,
      estimatedDuration: shotPlan.totalDuration,
      notes,
    };
  }

  /**
   * Generate slugline
   */
  private generateSlugline(input: SceneGenerationInput): string {
    const timePrefix = input.timeOfDay === 'night' || input.timeOfDay === 'midnight' ? 'NIGHT' : 'DAY';
    return `${timePrefix} - ${input.location.toUpperCase()}`;
  }

  /**
   * Generate visual description
   */
  private generateVisualDescription(
    shot: CameraShot,
    beat: string,
    input: SceneGenerationInput,
    context: SkillContext,
    panelIndex: number,
    totalPanels: number
  ): string {
    const sizeDesc = this.getSizeDescription(shot.size);
    const angleDesc = this.getAngleDescription(shot.angle);
    const moveDesc = this.getMovementDescription(shot.movement);
    
    let visual = `${sizeDesc} ${angleDesc}, ${moveDesc}. `;
    
    // Add beat context
    if (shot.beatIndex >= 0) {
      visual += `Beat: ${beat}. `;
    }
    
    // Add character details
    if (input.characters.length > 0) {
      const charNames = input.characters.map(c => context.characterBibles[c]?.name || c).join(', ');
      visual += `Characters: ${charNames}. `;
    }
    
    // Add location
    visual += `Location: ${input.location}. `;
    
    // Add focus
    visual += `Focus on ${shot.focus}. `;
    
    // Add composition
    visual += `Composition: ${shot.composition.framing} framing, ${shot.composition.depth} depth, ${shot.composition.ruleOfThirds}.`;
    
    return visual;
  }

  /**
   * Get size description
   */
  private getSizeDescription(size: string): string {
    const desc: Record<string, string> = {
      'extreme-wide': 'Extreme wide shot',
      'wide': 'Wide shot',
      'medium': 'Medium shot',
      'closeup': 'Close-up',
      'extreme-closeup': 'Extreme close-up',
      'over-the-shoulder': 'Over-the-shoulder shot',
    };
    return desc[size] || size;
  }

  /**
   * Get angle description
   */
  private getAngleDescription(angle: string): string {
    const desc: Record<string, string> = {
      'eye-level': 'at eye level',
      'low': 'from low angle',
      'high': 'from high angle',
      'overhead': 'from overhead',
      'dutch': 'with Dutch tilt',
      'pov': 'from POV',
    };
    return desc[angle] || angle;
  }

  /**
   * Get movement description
   */
  private getMovementDescription(movement: string): string {
    const desc: Record<string, string> = {
      'static': 'static camera',
      'pan': 'panning',
      'tilt': 'tilting',
      'dolly': 'dollying',
      'tracking': 'tracking',
      'crane': 'crane shot',
      'push': 'pushing in',
      'pull': 'pulling back',
      'zoom': 'zooming',
    };
    return desc[movement] || movement;
  }

  /**
   * Generate camera note
   */
  private generateCameraNote(shot: CameraShot): string {
    const notes = [];
    notes.push(`Lens: ${shot.size.includes('wide') ? 'wide-angle' : shot.size.includes('close') ? 'telephoto/macro' : 'normal'}`);
    notes.push(`Movement: ${shot.movement}`);
    if (shot.angle !== 'eye-level') notes.push(`Angle: ${shot.angle}`);
    return notes.join('; ');
  }

  /**
   * Generate lighting note
   */
  private generateLightingNote(shot: CameraShot, input: SceneGenerationInput): string {
    const timeOfDay = input.timeOfDay.toLowerCase();
    let lighting = '';
    
    switch (timeOfDay) {
      case 'dawn': lighting = 'Soft golden morning light, long shadows'; break;
      case 'morning': lighting = 'Bright morning light, crisp shadows'; break;
      case 'noon': lighting = 'Harsh overhead light, minimal shadows'; break;
      case 'afternoon': lighting = 'Warm afternoon light, medium shadows'; break;
      case 'evening': lighting = 'Golden hour, warm directional light'; break;
      case 'dusk': lighting = 'Fading twilight, soft ambient'; break;
      case 'night': lighting = 'Dark, moonlight/streetlight pools'; break;
      case 'midnight': lighting = 'Deep darkness, minimal practical sources'; break;
      default: lighting = 'Natural ambient light';
    }
    
    if (shot.size === 'closeup' || shot.size === 'extreme-closeup') {
      lighting += '; key light on subject face';
    }
    
    return lighting;
  }

  /**
   * Generate blocking note
   */
  private generateBlockingNote(shot: CameraShot, input: SceneGenerationInput, context: SkillContext): string {
    const chars = input.characters.map(c => context.characterBibles[c]?.name || c);
    
    if (chars.length === 0) return 'No characters in shot';
    if (chars.length === 1) return `${chars[0]} positioned for ${shot.composition.framing}`;
    
    if (shot.composition.framing === 'two-shot') {
      return `${chars[0]} and ${chars[1]} in two-shot, ${shot.composition.ruleOfThirds} framing`;
    }
    
    return `Group of ${chars.length} (${chars.join(', ')}) arranged for ${shot.composition.framing}`;
  }

  /**
   * Determine transition
   */
  private determineTransition(current: CameraShot, next: CameraShot): string {
    if (current.size === next.size && current.angle === next.angle) {
      return 'JUMP CUT (avoid)';
    }
    if (current.size === 'closeup' && next.size === 'wide') {
      return 'PULL BACK / WIDEN';
    }
    if (current.size === 'wide' && next.size === 'closeup') {
      return 'PUSH IN / CUT TO CLOSEUP';
    }
    if (current.movement === 'tracking' && next.movement === 'static') {
      return 'TRACKING SETTLES';
    }
    return 'CUT';
  }

  /**
   * Generate audio cue
   */
  private generateAudioCue(beat: string, shot: CameraShot, input: SceneGenerationInput): string {
    const cues = [];
    
    // Dialogue
    if (beat.toLowerCase().includes('talk') || beat.toLowerCase().includes('say') || beat.toLowerCase().includes('speak')) {
      cues.push('DIALOGUE');
    }
    
    // Action sounds
    if (beat.toLowerCase().includes('fight') || beat.toLowerCase().includes('hit') || beat.toLowerCase().includes('crash')) {
      cues.push('SFX: Impact sounds');
    }
    if (beat.toLowerCase().includes('door') || beat.toLowerCase().includes('open') || beat.toLowerCase().includes('close')) {
      cues.push('SFX: Door');
    }
    if (beat.toLowerCase().includes('footstep') || beat.toLowerCase().includes('walk') || beat.toLowerCase().includes('run')) {
      cues.push('SFX: Footsteps');
    }
    
    // Ambience
    cues.push(`AMBIENCE: ${input.location}`);
    
    return cues.join(' | ');
  }

  /**
   * Validate storyboard
   */
  private validateStoryboard(
    storyboard: StoryboardSequence,
    shotPlan: ShotPlan,
    issues: StoryboardIssue[]
  ): void {
    // Check coverage
    const shotIds = new Set(shotPlan.shots.map(s => s.id));
    const panelShotIds = new Set(storyboard.panels.map(p => p.shotId));
    
    for (const shotId of shotIds) {
      if (!panelShotIds.has(shotId)) {
        issues.push({
          type: 'missing-coverage',
          severity: 'medium',
          panels: [],
          description: `Shot ${shotId} has no storyboard panels`,
          suggestion: 'Add panels for all planned shots',
        });
      }
    }

    // Check for unclear visuals
    for (const panel of storyboard.panels) {
      if (panel.visual.length < 50) {
        issues.push({
          type: 'unclear-visual',
          severity: 'low',
          panels: [panel.panel],
          description: `Panel ${panel.panel} visual description too brief`,
          suggestion: 'Expand visual description with more detail',
        });
      }
    }

    // Check timing
    const totalPanelDuration = storyboard.panels.reduce((sum, p) => sum + p.duration, 0);
    if (Math.abs(totalPanelDuration - shotPlan.totalDuration) > shotPlan.totalDuration * 0.2) {
      issues.push({
        type: 'timing-mismatch',
        severity: 'medium',
        panels: [],
        description: `Panel durations (${totalPanelDuration}s) don't match shot plan (${shotPlan.totalDuration}s)`,
        suggestion: 'Adjust panel durations to match shot plan',
      });
    }

    // Check transitions
    const panelsWithTransitions = storyboard.panels.filter(p => p.transition && !p.transition.includes('JUMP CUT')).length;
    if (panelsWithTransitions < storyboard.panels.length * 0.5) {
      issues.push({
        type: 'transition-gap',
        severity: 'low',
        panels: [],
        description: 'Many panels missing transition notes',
        suggestion: 'Add transition notes between panels',
      });
    }
  }

  /**
   * Format storyboard output
   */
  formatStoryboard(storyboard: StoryboardSequence, format: StoryboardGeneratorConfig['format']): string {
    switch (format) {
      case 'markdown':
        return this.formatMarkdown(storyboard);
      case 'json':
        return JSON.stringify(storyboard, null, 2);
      case 'script':
        return this.formatScript(storyboard);
      default:
        return this.formatText(storyboard);
    }
  }

  /**
   * Format as markdown
   */
  private formatMarkdown(storyboard: StoryboardSequence): string {
    let md = `# Storyboard: Scene ${storyboard.sceneNumber}\n\n`;
    md += `**Slugline:** ${storyboard.slugline}\n\n`;
    md += `**Duration:** ~${storyboard.estimatedDuration} seconds | **Panels:** ${storyboard.totalPanels}\n\n`;
    md += `## Panels\n\n`;
    
    for (const panel of storyboard.panels) {
      md += `### Panel ${panel.panel} (Shot: ${panel.shotId})\n\n`;
      md += `**Visual:** ${panel.visual}\n\n`;
      if (panel.camera) md += `**Camera:** ${panel.camera}\n\n`;
      if (panel.lighting) md += `**Lighting:** ${panel.lighting}\n\n`;
      if (panel.blocking) md += `**Blocking:** ${panel.blocking}\n\n`;
      if (panel.audio) md += `**Audio:** ${panel.audio}\n\n`;
      if (panel.transition) md += `**Transition:** ${panel.transition}\n\n`;
      md += `---\n\n`;
    }
    
    if (storyboard.notes.length > 0) {
      md += `## Notes\n\n`;
      for (const note of storyboard.notes) {
        md += `- ${note}\n`;
      }
    }
    
    return md;
  }

  /**
   * Format as text
   */
  private formatText(storyboard: StoryboardSequence): string {
    let text = `STORYBOARD - Scene ${storyboard.sceneNumber}\n`;
    text += `Slugline: ${storyboard.slugline}\n`;
    text += `Duration: ${storyboard.estimatedDuration}s | Panels: ${storyboard.totalPanels}\n\n`;
    
    for (const panel of storyboard.panels) {
      text += `PANEL ${panel.panel} [${panel.shotId}]\n`;
      text += `Visual: ${panel.visual}\n`;
      if (panel.camera) text += `Camera: ${panel.camera}\n`;
      if (panel.lighting) text += `Lighting: ${panel.lighting}\n`;
      if (panel.blocking) text += `Blocking: ${panel.blocking}\n`;
      if (panel.audio) text += `Audio: ${panel.audio}\n`;
      if (panel.transition) text += `Transition: ${panel.transition}\n`;
      text += `\n`;
    }
    
    return text;
  }

  /**
   * Format as script
   */
  private formatScript(storyboard: StoryboardSequence): string {
    let script = `${storyboard.slugline}\n\n`;
    
    for (const panel of storyboard.panels) {
      script += `[PANEL ${panel.panel}] ${panel.visual}\n`;
      if (panel.camera) script += `    CAMERA: ${panel.camera}\n`;
      if (panel.lighting) script += `    LIGHTING: ${panel.lighting}\n`;
      if (panel.audio) script += `    AUDIO: ${panel.audio}\n`;
      if (panel.transition) script += `    > ${panel.transition}\n`;
      script += `\n`;
    }
    
    return script;
  }
}

/**
 * Factory for creating StoryboardGenerator
 */
export async function createStoryboardGenerator(
  config?: Partial<StoryboardGeneratorConfig>
): Promise<StoryboardGenerator> {
  const skill = new StoryboardGenerator();
  await skill.initialize(config);
  return skill;
}