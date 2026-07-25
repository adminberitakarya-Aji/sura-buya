/**
 * Suro-Buya Engine v2 - Visual Language Enforcer Skill
 * 
 * Enforces consistent visual language and style across episodes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { CameraSkill } from '../base.js';
import type { SceneGenerationInput, WorldProfile, VisualStyle } from '../../types.js';

/**
 * Visual Language Enforcer configuration
 */
export interface VisualLanguageEnforcerConfig extends Record<string, unknown> {
  [key: string]: unknown;
  /** Enforce color palette */
  enforcePalette: boolean;
  /** Enforce lighting style */
  enforceLighting: boolean;
  /** Enforce composition rules */
  enforceComposition: boolean;
  /** Enforce camera style */
  enforceCameraStyle: boolean;
  /** Allowed deviation threshold */
  deviationThreshold: number;
}

/**
 * Visual style profile
 */
export interface VisualStyleProfile {
  /** Style ID */
  id: string;
  /** Style name */
  name: string;
  /** Color palette */
  colorPalette: ColorPalette;
  /** Lighting style */
  lighting: LightingStyle;
  /** Composition preferences */
  composition: CompositionRules;
  /** Camera style */
  camera: CameraStyle;
  /** Mood/atmosphere */
  mood: string;
  /** Reference scenes */
  referenceScenes: string[];
}

/**
 * Color palette
 */
export interface ColorPalette {
  /** Primary colors */
  primary: string[];
  /** Secondary colors */
  secondary: string[];
  /** Accent colors */
  accent: string[];
  /** Forbidden colors */
  forbidden: string[];
  /** Color temperature */
  temperature: 'warm' | 'cool' | 'neutral' | 'mixed';
  /** Saturation level */
  saturation: 'high' | 'medium' | 'low' | 'desaturated';
  /** Contrast level */
  contrast: 'high' | 'medium' | 'low';
}

/**
 * Lighting style
 */
export interface LightingStyle {
  /** Key light style */
  keyLight: 'hard' | 'soft' | 'natural' | 'dramatic' | 'chiaroscuro';
  /** Fill light ratio */
  fillRatio: 'high' | 'medium' | 'low' | 'none';
  /** Practical lights */
  practicals: boolean;
  /** Motivated lighting */
  motivated: boolean;
  /** Time of day consistency */
  timeOfDayConsistency: boolean;
  /** Special techniques */
  techniques: string[];
}

/**
 * Composition rules
 */
export interface CompositionRules {
  /** Preferred framing */
  framing: ('rule-of-thirds' | 'center' | 'golden-ratio' | 'symmetry' | 'asymmetry' | 'two-shot' | 'group')[];
  /** Depth preference */
  depth: 'shallow' | 'medium' | 'deep' | 'variable';
  /** Leading lines usage */
  leadingLines: boolean;
  /** Negative space */
  negativeSpace: 'minimal' | 'moderate' | 'extensive';
  /** Frame within frame */
  frameWithinFrame: boolean;
}

/**
 * Camera style
 */
export interface CameraStyle {
  /** Preferred lenses */
  lenses: ('wide' | 'normal' | 'telephoto' | 'macro' | 'anamorphic')[];
  /** Movement style */
  movement: 'static' | 'fluid' | 'handheld' | 'stabilized' | 'mixed';
  /** Focus style */
  focus: 'deep' | 'shallow' | 'rack' | 'variable';
  /** Aspect ratio */
  aspectRatio: string;
  /** Texture/grain */
  texture: 'clean' | 'film-grain' | 'digital-noise' | 'vintage';
}

/**
 * Visual analysis result
 */
export interface VisualAnalysis {
  /** Scene number */
  sceneNumber: number;
  /** Detected visual style */
  detectedStyle: Partial<VisualStyleProfile>;
  /** Compliance score */
  complianceScore: number;
  /** Violations */
  violations: VisualViolation[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Visual violation
 */
export interface VisualViolation {
  /** Violation type */
  type: 'color-deviation' | 'lighting-inconsistency' | 'composition-break' | 'camera-style-shift' | 'mismatch-reference';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Element */
  element: string;
  /** Expected */
  expected: string;
  /** Actual */
  actual: string;
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Visual Language Enforcer Skill
 * Enforces consistent visual language across episodes
 */
export class VisualLanguageEnforcer extends CameraSkill<SceneGenerationInput, VisualAnalysis> {
  override name = 'VisualLanguageEnforcer';
  override version = '1.0.0';
  override description = 'Enforces consistent visual language and style across episodes';
  override dependencies: string[] = ['ShotComposer', 'ContinuityGuard'];
  override required = false;
  
  override configSchema = z.object({
    enforcePalette: z.boolean().default(true),
    enforceLighting: z.boolean().default(true),
    enforceComposition: z.boolean().default(true),
    enforceCameraStyle: z.boolean().default(true),
    deviationThreshold: z.number().min(0).max(1).default(0.2),
  });

  override defaultConfig: Record<string, unknown> = {
    enforcePalette: true,
    enforceLighting: true,
    enforceComposition: true,
    enforceCameraStyle: true,
    deviationThreshold: 0.2,
  };

  protected override config: VisualLanguageEnforcerConfig = {
    enforcePalette: true,
    enforceLighting: true,
    enforceComposition: true,
    enforceCameraStyle: true,
    deviationThreshold: 0.2,
  };

  // Series visual style profile
  private seriesStyle: VisualStyleProfile | null = null;

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<VisualAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const violations: VisualViolation[] = [];
      const recommendations: string[] = [];

      // Get or build series visual style
      const style = this.getSeriesStyle(context);
      this.seriesStyle = style;

      // Analyze current scene for visual style
      const detectedStyle = this.analyzeSceneVisuals(input, context);

      // Check compliance
      if (cfg.enforcePalette) {
        this.checkPaletteCompliance(detectedStyle, style, violations);
      }
      if (cfg.enforceLighting) {
        this.checkLightingCompliance(detectedStyle, style, violations);
      }
      if (cfg.enforceComposition) {
        this.checkCompositionCompliance(detectedStyle, style, violations);
      }
      if (cfg.enforceCameraStyle) {
        this.checkCameraStyleCompliance(detectedStyle, style, violations);
      }

      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(violations, cfg.deviationThreshold);

      // Generate recommendations
      if (violations.some(v => v.type === 'color-deviation')) {
        recommendations.push('Align scene colors with series palette');
      }
      if (violations.some(v => v.type === 'lighting-inconsistency')) {
        recommendations.push('Match lighting style to series established look');
      }
      if (violations.some(v => v.type === 'composition-break')) {
        recommendations.push('Follow series composition conventions');
      }
      if (complianceScore > 0.8) {
        recommendations.push('Visual style highly consistent with series');
      }

      const analysis: VisualAnalysis = {
        sceneNumber: input.sceneNumber,
        detectedStyle,
        complianceScore,
        violations,
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
   * Get or build series visual style
   */
  private getSeriesStyle(context: SkillContext): VisualStyleProfile {
    if (this.seriesStyle) return this.seriesStyle;

    // Build from world bibles and previous scenes
    const worlds = Object.values(context.worldBibles);
    const primaryWorld = worlds[0];

    // Extract visual style from world
    const style: VisualStyleProfile = {
      id: 'series-visual-style',
      name: 'Series Visual Language',
      colorPalette: this.extractColorPalette(primaryWorld),
      lighting: this.extractLightingStyle(primaryWorld),
      composition: this.extractCompositionRules(primaryWorld),
      camera: this.extractCameraStyle(primaryWorld),
      mood: primaryWorld?.description?.slice(0, 100) || 'cinematic',
      referenceScenes: [],
    };

    return style;
  }

  /**
   * Extract color palette from world
   */
  private extractColorPalette(world?: WorldProfile): ColorPalette {
    if (!world) {
      return this.getDefaultPalette();
    }

    // Infer from world description, geography, culture
    const desc = (world.description + ' ' + world.geography?.climate + ' ' + world.culture?.beliefs.join(' ')).toLowerCase();
    
    let palette = this.getDefaultPalette();
    
    if (desc.includes('fantasy') || desc.includes('magic') || desc.includes('medieval')) {
      palette = {
        primary: ['#8B4513', '#2E8B57', '#FFD700', '#8B0000'],
        secondary: ['#DEB887', '#556B2F', '#CD853F', '#4682B4'],
        accent: ['#FF6347', '#9370DB', '#00CED1'],
        forbidden: ['#00FF00', '#FF00FF', '#00FFFF'],
        temperature: 'warm',
        saturation: 'medium',
        contrast: 'medium',
      };
    } else if (desc.includes('sci-fi') || desc.includes('space') || desc.includes('future')) {
      palette = {
        primary: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
        secondary: ['#00d9ff', '#ff6b6b', '#4ecdc4', '#ffe66d'],
        accent: ['#ff006e', '#8338ec', '#3a86ff'],
        forbidden: ['#8B4513', '#DEB887', '#CD853F'],
        temperature: 'cool',
        saturation: 'high',
        contrast: 'high',
      };
    } else if (desc.includes('noir') || desc.includes('dark') || desc.includes('gritty')) {
      palette = {
        primary: ['#0d0d0d', '#1a1a1a', '#2d2d2d', '#ffffff'],
        secondary: ['#4a4a4a', '#666666', '#999999'],
        accent: ['#ff0000', '#ffaa00', '#00ff00'],
        forbidden: ['#ffcccc', '#ccffcc', '#ccccff'],
        temperature: 'neutral',
        saturation: 'low',
        contrast: 'high',
      };
    } else if (desc.includes('romance') || desc.includes('dream') || desc.includes('pastel')) {
      palette = {
        primary: ['#ffb6c1', '#ffc0cb', '#ffe4e1', '#fff0f5'],
        secondary: ['#e6e6fa', '#f0f8ff', '#f5f5dc', '#fffacd'],
        accent: ['#ff69b4', '#da70d6', '#9370db'],
        forbidden: ['#000000', '#333333', '#666666'],
        temperature: 'warm',
        saturation: 'low',
        contrast: 'low',
      };
    }

    return palette;
  }

  /**
   * Get default palette
   */
  private getDefaultPalette(): ColorPalette {
    return {
      primary: ['#2c3e50', '#34495e', '#ecf0f1', '#e74c3c'],
      secondary: ['#3498db', '#2ecc71', '#f39c12', '#9b59b6'],
      accent: ['#e67e22', '#1abc9c', '#95a5a6'],
      forbidden: [],
      temperature: 'neutral',
      saturation: 'medium',
      contrast: 'medium',
    };
  }

  /**
   * Extract lighting style
   */
  private extractLightingStyle(world?: WorldProfile): LightingStyle {
    if (!world) {
      return {
        keyLight: 'natural',
        fillRatio: 'medium',
        practicals: true,
        motivated: true,
        timeOfDayConsistency: true,
        techniques: ['three-point', 'motivated'],
      };
    }

    const desc = (world.description + ' ' + world.geography?.climate).toLowerCase();
    
    if (desc.includes('noir') || desc.includes('dark') || desc.includes('shadow')) {
      return {
        keyLight: 'hard',
        fillRatio: 'low',
        practicals: true,
        motivated: true,
        timeOfDayConsistency: true,
        techniques: ['chiaroscuro', 'silhouette', 'venetian-blinds'],
      };
    }
    
    if (desc.includes('bright') || desc.includes('sunny') || desc.includes('tropical')) {
      return {
        keyLight: 'natural',
        fillRatio: 'high',
        practicals: true,
        motivated: true,
        timeOfDayConsistency: true,
        techniques: ['high-key', 'natural-light', 'bounce'],
      };
    }

    return {
      keyLight: 'soft',
      fillRatio: 'medium',
      practicals: true,
      motivated: true,
      timeOfDayConsistency: true,
      techniques: ['three-point', 'motivated', 'practical'],
    };
  }

  /**
   * Extract composition rules
   */
  private extractCompositionRules(world?: WorldProfile): CompositionRules {
    if (!world) {
      return {
        framing: ['rule-of-thirds', 'center'],
        depth: 'medium',
        leadingLines: true,
        negativeSpace: 'moderate',
        frameWithinFrame: true,
      };
    }

    const desc = world.description.toLowerCase();
    
    if (desc.includes('epic') || desc.includes('grand') || desc.includes('vast')) {
      return {
        framing: ['rule-of-thirds', 'golden-ratio', 'symmetry'],
        depth: 'deep',
        leadingLines: true,
        negativeSpace: 'extensive',
        frameWithinFrame: true,
      };
    }
    
    if (desc.includes('intimate') || desc.includes('personal') || desc.includes('close')) {
      return {
        framing: ['center', 'rule-of-thirds'],
        depth: 'shallow',
        leadingLines: false,
        negativeSpace: 'minimal',
        frameWithinFrame: false,
      };
    }

    return {
      framing: ['rule-of-thirds', 'center'],
      depth: 'medium',
      leadingLines: true,
      negativeSpace: 'moderate',
      frameWithinFrame: true,
    };
  }

  /**
   * Extract camera style
   */
  private extractCameraStyle(world?: WorldProfile): CameraStyle {
    if (!world) {
      return {
        lenses: ['wide', 'normal', 'telephoto'],
        movement: 'fluid',
        focus: 'variable',
        aspectRatio: '16:9',
        texture: 'clean',
      };
    }

    const desc = world.description.toLowerCase();
    const type = world.type || '';
    
    if (type === 'planet' || desc.includes('cinematic') || desc.includes('film')) {
      return {
        lenses: ['anamorphic', 'wide', 'telephoto'],
        movement: 'fluid',
        focus: 'variable',
        aspectRatio: '2.39:1',
        texture: 'film-grain',
      };
    }
    
    if (desc.includes('documentary') || desc.includes('realistic') || desc.includes('gritty')) {
      return {
        lenses: ['wide', 'normal'],
        movement: 'handheld',
        focus: 'deep',
        aspectRatio: '16:9',
        texture: 'digital-noise',
      };
    }

    if (desc.includes('vintage') || desc.includes('retro') || desc.includes('period')) {
      return {
        lenses: ['normal', 'telephoto'],
        movement: 'static',
        focus: 'shallow',
        aspectRatio: '4:3',
        texture: 'vintage',
      };
    }

    return {
      lenses: ['wide', 'normal', 'telephoto'],
      movement: 'fluid',
      focus: 'variable',
      aspectRatio: '16:9',
      texture: 'clean',
    };
  }

  /**
   * Analyze scene visuals
   */
  private analyzeSceneVisuals(input: SceneGenerationInput, context: SkillContext): Partial<VisualStyleProfile> {
    const detected: Partial<VisualStyleProfile> = {
      colorPalette: this.detectColorPalette(input),
      lighting: this.detectLighting(input),
      composition: this.detectComposition(input),
      camera: this.detectCameraStyle(input),
      mood: this.detectMood(input),
    };
    return detected;
  }

  /**
   * Detect color palette from scene
   */
  private detectColorPalette(input: SceneGenerationInput): ColorPalette {
    const text = (input.keyBeats.join(' ') + ' ' + input.location + ' ' + input.timeOfDay).toLowerCase();
    
    // Simple keyword-based detection
    const warmKeywords = ['warm', 'golden', 'sunset', 'fire', 'candle', 'amber', 'orange', 'red'];
    const coolKeywords = ['cool', 'blue', 'moon', 'night', 'ice', 'cold', 'steel', 'silver'];
    const desatKeywords = ['bleak', 'gray', 'grey', 'drab', 'muted', 'washed', 'pale'];
    const highContrastKeywords = ['contrast', 'shadow', 'dark', 'noir', 'chiaroscuro', 'stark'];
    
    let temperature: ColorPalette['temperature'] = 'neutral';
    let saturation: ColorPalette['saturation'] = 'medium';
    let contrast: ColorPalette['contrast'] = 'medium';
    
    if (warmKeywords.some(k => text.includes(k))) temperature = 'warm';
    if (coolKeywords.some(k => text.includes(k))) temperature = 'cool';
    if (desatKeywords.some(k => text.includes(k))) saturation = 'low';
    if (highContrastKeywords.some(k => text.includes(k))) contrast = 'high';
    
    return {
      primary: [],
      secondary: [],
      accent: [],
      forbidden: [],
      temperature,
      saturation,
      contrast,
    };
  }

  /**
   * Detect lighting from scene
   */
  private detectLighting(input: SceneGenerationInput): LightingStyle {
    const text = (input.keyBeats.join(' ') + ' ' + input.timeOfDay).toLowerCase();
    
    let keyLight: LightingStyle['keyLight'] = 'natural';
    let fillRatio: LightingStyle['fillRatio'] = 'medium';
    
    if (text.includes('harsh') || text.includes('direct sun') || text.includes('noon')) {
      keyLight = 'hard';
      fillRatio = 'low';
    } else if (text.includes('soft') || text.includes('diffused') || text.includes('overcast') || text.includes('golden hour')) {
      keyLight = 'soft';
      fillRatio = 'high';
    } else if (text.includes('dramatic') || text.includes('chiaroscuro') || text.includes('noir')) {
      keyLight = 'dramatic';
      fillRatio = 'low';
    } else if (text.includes('candle') || text.includes('firelight') || text.includes('practical')) {
      keyLight = 'natural';
      fillRatio = 'low';
    }
    
    return {
      keyLight,
      fillRatio,
      practicals: text.includes('lamp') || text.includes('candle') || text.includes('fire'),
      motivated: true,
      timeOfDayConsistency: true,
      techniques: [],
    };
  }

  /**
   * Detect composition from scene
   */
  private detectComposition(input: SceneGenerationInput): CompositionRules {
    const charCount = input.characters.length;
    const text = input.keyBeats.join(' ').toLowerCase();
    
    let framing: CompositionRules['framing'] = ['rule-of-thirds'];
    let depth: CompositionRules['depth'] = 'medium';
    let negativeSpace: CompositionRules['negativeSpace'] = 'moderate';
    
    if (charCount === 1) {
      framing = ['center', 'rule-of-thirds'];
      if (text.includes('isolat') || text.includes('alone')) {
        negativeSpace = 'extensive';
        depth = 'shallow';
      }
    } else if (charCount === 2) {
      framing = ['rule-of-thirds', 'two-shot'];
    } else {
      framing = ['center', 'group'];
      depth = 'deep';
    }
    
    if (text.includes('environment') || text.includes('landscape') || text.includes('vast')) {
      depth = 'deep';
      negativeSpace = 'extensive';
    }
    
    return {
      framing,
      depth,
      leadingLines: text.includes('path') || text.includes('road') || text.includes('line'),
      negativeSpace,
      frameWithinFrame: text.includes('window') || text.includes('door') || text.includes('arch'),
    };
  }

  /**
   * Detect camera style from scene
   */
  private detectCameraStyle(input: SceneGenerationInput): CameraStyle {
    const text = input.keyBeats.join(' ').toLowerCase();
    
    let movement: CameraStyle['movement'] = 'fluid';
    let focus: CameraStyle['focus'] = 'variable';
    
    if (text.includes('handheld') || text.includes('shaky') || text.includes('urgent')) {
      movement = 'handheld';
    } else if (text.includes('static') || text.includes('locked') || text.includes('still')) {
      movement = 'static';
    } else if (text.includes('smooth') || text.includes('glide') || text.includes('crane')) {
      movement = 'fluid';
    }
    
    if (text.includes('shallow') || text.includes('bokeh') || text.includes('focus on')) {
      focus = 'shallow';
    } else if (text.includes('deep') || text.includes('everything sharp')) {
      focus = 'deep';
    }
    
    return {
      lenses: ['normal'],
      movement,
      focus,
      aspectRatio: '16:9',
      texture: 'clean',
    };
  }

  /**
   * Detect mood
   */
  private detectMood(input: SceneGenerationInput): string {
    const text = input.keyBeats.join(' ').toLowerCase();
    
    if (text.includes('tension') || text.includes('suspense') || text.includes('thrill')) return 'tense';
    if (text.includes('romantic') || text.includes('love') || text.includes('tender')) return 'romantic';
    if (text.includes('action') || text.includes('fight') || text.includes('chase')) return 'energetic';
    if (text.includes('sad') || text.includes('grief') || text.includes('loss')) return 'melancholic';
    if (text.includes('joy') || text.includes('happy') || text.includes('celebrat')) return 'joyful';
    if (text.includes('mystery') || text.includes('secret') || text.includes('unknown')) return 'mysterious';
    if (text.includes('fear') || text.includes('horror') || text.includes('terror')) return 'frightening';
    
    return 'neutral';
  }

  /**
   * Check palette compliance
   */
  private checkPaletteCompliance(
    detected: Partial<VisualStyleProfile>,
    expected: VisualStyleProfile,
    violations: VisualViolation[]
  ): void {
    if (!detected.colorPalette || !expected.colorPalette) return;
    
    const d = detected.colorPalette;
    const e = expected.colorPalette;
    
    if (d.temperature !== e.temperature) {
      violations.push({
        type: 'color-deviation',
        severity: 'medium',
        element: 'color temperature',
        expected: e.temperature,
        actual: d.temperature,
        description: `Color temperature mismatch: expected ${e.temperature}, got ${d.temperature}`,
        suggestion: `Adjust color grading to ${e.temperature} tones`,
      });
    }
    
    if (d.saturation !== e.saturation) {
      violations.push({
        type: 'color-deviation',
        severity: 'low',
        element: 'saturation',
        expected: e.saturation,
        actual: d.saturation,
        description: `Saturation level mismatch: expected ${e.saturation}, got ${d.saturation}`,
        suggestion: `Adjust saturation to ${e.saturation}`,
      });
    }
    
    if (d.contrast !== e.contrast) {
      violations.push({
        type: 'color-deviation',
        severity: 'medium',
        element: 'contrast',
        expected: e.contrast,
        actual: d.contrast,
        description: `Contrast level mismatch: expected ${e.contrast}, got ${d.contrast}`,
        suggestion: `Adjust contrast to ${e.contrast}`,
      });
    }
  }

  /**
   * Check lighting compliance
   */
  private checkLightingCompliance(
    detected: Partial<VisualStyleProfile>,
    expected: VisualStyleProfile,
    violations: VisualViolation[]
  ): void {
    if (!detected.lighting || !expected.lighting) return;
    
    const d = detected.lighting;
    const e = expected.lighting;
    
    if (d.keyLight !== e.keyLight) {
      violations.push({
        type: 'lighting-inconsistency',
        severity: 'medium',
        element: 'key light style',
        expected: e.keyLight,
        actual: d.keyLight,
        description: `Key light style mismatch: expected ${e.keyLight}, got ${d.keyLight}`,
        suggestion: `Use ${e.keyLight} key lighting`,
      });
    }
    
    if (d.fillRatio !== e.fillRatio) {
      violations.push({
        type: 'lighting-inconsistency',
        severity: 'low',
        element: 'fill ratio',
        expected: e.fillRatio,
        actual: d.fillRatio,
        description: `Fill light ratio mismatch: expected ${e.fillRatio}, got ${d.fillRatio}`,
        suggestion: `Adjust fill light to ${e.fillRatio}`,
      });
    }
  }

  /**
   * Check composition compliance
   */
  private checkCompositionCompliance(
    detected: Partial<VisualStyleProfile>,
    expected: VisualStyleProfile,
    violations: VisualViolation[]
  ): void {
    if (!detected.composition || !expected.composition) return;
    
    const d = detected.composition;
    const e = expected.composition;
    
    // Check framing
    const hasCommonFraming = d.framing.some(f => e.framing.includes(f));
    if (!hasCommonFraming && d.framing.length > 0) {
      violations.push({
        type: 'composition-break',
        severity: 'low',
        element: 'framing',
        expected: e.framing.join(', '),
        actual: d.framing.join(', '),
        description: `Framing style doesn't match series: ${d.framing.join(', ')} vs ${e.framing.join(', ')}`,
        suggestion: `Use series framing: ${e.framing.join(' or ')}`,
      });
    }
    
    // Check depth
    if (d.depth !== e.depth) {
      violations.push({
        type: 'composition-break',
        severity: 'low',
        element: 'depth',
        expected: e.depth,
        actual: d.depth,
        description: `Depth preference mismatch: expected ${e.depth}, got ${d.depth}`,
        suggestion: `Compose for ${e.depth} depth`,
      });
    }
  }

  /**
   * Check camera style compliance
   */
  private checkCameraStyleCompliance(
    detected: Partial<VisualStyleProfile>,
    expected: VisualStyleProfile,
    violations: VisualViolation[]
  ): void {
    if (!detected.camera || !expected.camera) return;
    
    const d = detected.camera;
    const e = expected.camera;
    
    if (d.movement !== e.movement) {
      violations.push({
        type: 'camera-style-shift',
        severity: 'medium',
        element: 'camera movement',
        expected: e.movement,
        actual: d.movement,
        description: `Camera movement style mismatch: expected ${e.movement}, got ${d.movement}`,
        suggestion: `Use ${e.movement} camera movement`,
      });
    }
    
    if (d.focus !== e.focus) {
      violations.push({
        type: 'camera-style-shift',
        severity: 'low',
        element: 'focus style',
        expected: e.focus,
        actual: d.focus,
        description: `Focus style mismatch: expected ${e.focus}, got ${d.focus}`,
        suggestion: `Use ${e.focus} focus technique`,
      });
    }
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(violations: VisualViolation[], threshold: number): number {
    if (violations.length === 0) return 1.0;
    
    let score = 1.0;
    for (const v of violations) {
      switch (v.severity) {
        case 'high': score -= 0.3; break;
        case 'medium': score -= 0.15; break;
        case 'low': score -= 0.05; break;
      }
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Set series style manually
   */
  setSeriesStyle(style: VisualStyleProfile): void {
    this.seriesStyle = style;
  }

  /**
   * Get current series style
   */
  getCurrentSeriesStyle(): VisualStyleProfile | null {
    return this.seriesStyle;
  }
}

/**
 * Factory for creating VisualLanguageEnforcer
 */
export async function createVisualLanguageEnforcer(
  config?: Partial<VisualLanguageEnforcerConfig>
): Promise<VisualLanguageEnforcer> {
  const skill = new VisualLanguageEnforcer();
  await skill.initialize(config);
  return skill;
}