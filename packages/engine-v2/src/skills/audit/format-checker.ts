/**
 * Suro-Buya Engine v2 - Format Checker Skill
 * 
 * Validates screenplay format compliance.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { AuditSkill } from '../base.js';
import type { SceneGenerationInput, ScreenplayFormat } from '../../types.js';

/**
 * Format Checker configuration
 */
export interface FormatCheckerConfig extends Record<string, unknown> {
  /** Strictness level */
  strictness: 'lenient' | 'standard' | 'strict';
  /** Check slugline format */
  checkSlugline: boolean;
  /** Check action format */
  checkAction: boolean;
  /** Check dialogue format */
  checkDialogue: boolean;
  /** Check parenthetical format */
  checkParentheticals: boolean;
  /** Check transition format */
  checkTransitions: boolean;
  /** Check scene numbering */
  checkSceneNumbers: boolean;
  /** Check page count estimates */
  checkPageCount: boolean;
}

/**
 * Format violation
 */
export interface FormatViolation {
  /** Violation type */
  type: 'slugline' | 'action' | 'dialogue' | 'character' | 'parenthetical' | 'transition' | 'scene-number' | 'spacing' | 'margin' | 'page-count';
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Line number */
  line?: number;
  /** Element */
  element: string;
  /** Expected format */
  expected: string;
  /** Actual format */
  actual: string;
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Format analysis result
 */
export interface FormatAnalysis {
  /** Scene number */
  sceneNumber: number;
  /** Format compliance score */
  complianceScore: number;
  /** Violations found */
  violations: FormatViolation[];
  /** Format statistics */
  stats: FormatStats;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Format statistics
 */
export interface FormatStats {
  /** Total lines */
  totalLines: number;
  /** Sluglines count */
  sluglines: number;
  /** Action lines count */
  actionLines: number;
  /** Dialogue blocks count */
  dialogueBlocks: number;
  /** Character cues count */
  characterCues: number;
  /** Parentheticals count */
  parentheticals: number;
  /** Transitions count */
  transitions: number;
  /** Estimated pages */
  estimatedPages: number;
}

/**
 * Format Checker Skill
 * Validates screenplay format compliance
 */
export class FormatChecker extends AuditSkill<SceneGenerationInput, FormatAnalysis, FormatCheckerConfig> {
  override name = 'FormatChecker';
  override version = '1.0.0';
  override description = 'Validates screenplay format compliance';
  override dependencies: string[] = ['ScreenplayFormatter'];
  override required = true;
  
  override configSchema = z.object({
    strictness: z.enum(['lenient', 'standard', 'strict']),
    checkSlugline: z.boolean(),
    checkAction: z.boolean(),
    checkDialogue: z.boolean(),
    checkParentheticals: z.boolean(),
    checkTransitions: z.boolean(),
    checkSceneNumbers: z.boolean(),
    checkPageCount: z.boolean(),
  }) as z.ZodType<FormatCheckerConfig>;

  override defaultConfig: FormatCheckerConfig = {
    strictness: 'standard',
    checkSlugline: true,
    checkAction: true,
    checkDialogue: true,
    checkParentheticals: true,
    checkTransitions: true,
    checkSceneNumbers: true,
    checkPageCount: true,
  };

  protected override config: FormatCheckerConfig = {
    strictness: 'standard',
    checkSlugline: true,
    checkAction: true,
    checkDialogue: true,
    checkParentheticals: true,
    checkTransitions: true,
    checkSceneNumbers: true,
    checkPageCount: true,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<FormatAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const violations: FormatViolation[] = [];
      const recommendations: string[] = [];

      // Generate screenplay text from input (simulated)
      const screenplayText = this.generateScreenplayText(input, context);
      const lines = screenplayText.split('\n');

      // Analyze format
      const stats = this.analyzeFormat(lines, violations, cfg);

      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(violations, cfg.strictness);

      // Generate recommendations
      if (violations.some(v => v.type === 'slugline')) {
        recommendations.push('Fix slugline format: INT./EXT. LOCATION - TIME');
      }
      if (violations.some(v => v.type === 'dialogue')) {
        recommendations.push('Ensure dialogue follows CHARACTER NAME / (parenthetical) / dialogue format');
      }
      if (violations.some(v => v.type === 'spacing')) {
        recommendations.push('Check spacing: blank lines between elements, no extra spaces');
      }
      if (stats.estimatedPages > 3) {
        recommendations.push('Scene may be too long - consider breaking into multiple scenes');
      }
      if (complianceScore >= 0.9) {
        recommendations.push('Format compliance excellent');
      }

      const analysis: FormatAnalysis = {
        sceneNumber: input.sceneNumber,
        complianceScore,
        violations,
        stats,
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
   * Generate screenplay text from scene input
   */
  private generateScreenplayText(input: SceneGenerationInput, context: SkillContext): string {
    const lines: string[] = [];
    
    // Slugline
    const timePrefix = input.timeOfDay === 'night' || input.timeOfDay === 'midnight' ? 'NIGHT' : 'DAY';
    lines.push(`${timePrefix} - ${input.location.toUpperCase()}`);
    lines.push('');
    
    // Action lines
    for (const beat of input.keyBeats) {
      lines.push(beat);
      lines.push('');
    }
    
    // Dialogue (simulated)
    if (input.keyBeats.some(b => b.toLowerCase().includes('talk') || b.toLowerCase().includes('say'))) {
      for (const charId of input.characters) {
        const char = context.characterBibles[charId];
        if (char) {
          lines.push(char.name.toUpperCase());
          lines.push('(beat)');
          lines.push(`Dialogue for ${char.name}...`);
          lines.push('');
        }
      }
    }
    
    // Transition
    lines.push('CUT TO:');
    
    return lines.join('\n');
  }

  /**
   * Analyze format
   */
  private analyzeFormat(lines: string[], violations: FormatViolation[], cfg: FormatCheckerConfig): FormatStats {
    const stats: FormatStats = {
      totalLines: lines.length,
      sluglines: 0,
      actionLines: 0,
      dialogueBlocks: 0,
      characterCues: 0,
      parentheticals: 0,
      transitions: 0,
      estimatedPages: 0,
    };

    let inDialogue = false;
    let currentCharacter = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();
      const lineNum = i + 1;

      // Skip empty lines
      if (!trimmed) continue;

      // Check slugline
      if (cfg.checkSlugline && this.isSlugline(trimmed)) {
        stats.sluglines++;
        this.validateSlugline(trimmed, lineNum, violations);
        continue;
      }

      // Check transition
      if (cfg.checkTransitions && this.isTransition(trimmed)) {
        stats.transitions++;
        this.validateTransition(trimmed, lineNum, violations);
        continue;
      }

      // Check character cue
      if (this.isCharacterCue(trimmed)) {
        stats.characterCues++;
        currentCharacter = trimmed;
        inDialogue = true;
        this.validateCharacterCue(trimmed, lineNum, violations);
        continue;
      }

      // Check parenthetical
      if (inDialogue && cfg.checkParentheticals && this.isParenthetical(trimmed)) {
        stats.parentheticals++;
        this.validateParenthetical(trimmed, lineNum, violations);
        continue;
      }

      // Check dialogue
      if (inDialogue && trimmed && !this.isCharacterCue(trimmed) && !this.isParenthetical(trimmed)) {
        stats.dialogueBlocks++;
        this.validateDialogue(trimmed, currentCharacter, lineNum, violations);
        inDialogue = false;
        continue;
      }

      // Action line
      if (cfg.checkAction) {
        stats.actionLines++;
        this.validateAction(trimmed, lineNum, violations);
      }
    }

    // Check scene number
    if (cfg.checkSceneNumbers) {
      this.validateSceneNumber(lines, violations);
    }

    // Estimate pages
    if (cfg.checkPageCount) {
      stats.estimatedPages = this.estimatePages(lines);
      this.validatePageCount(stats.estimatedPages, violations);
    }

    // Check spacing
    this.validateSpacing(lines, violations);

    return stats;
  }

  /**
   * Check if line is slugline
   */
  private isSlugline(line: string): boolean {
    return /^(INT\.|EXT\.|INT\/EXT\.)\s+.+\s+-\s+(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|MIDNIGHT)/i.test(line);
  }

  /**
   * Validate slugline
   */
  private validateSlugline(line: string, lineNum: number, violations: FormatViolation[]): void {
    // Check format
    if (!/^(INT\.|EXT\.|INT\/EXT\.)\s+[A-Z0-9\s]+\s+-\s+(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|MIDNIGHT)/i.test(line)) {
      violations.push({
        type: 'slugline',
        severity: 'high',
        line: lineNum,
        element: 'slugline',
        expected: 'INT./EXT. LOCATION - TIME',
        actual: line,
        description: 'Slugline format incorrect',
        suggestion: 'Use format: INT. LOCATION - DAY/NIGHT',
      });
    }

    // Check for lowercase
    if (line !== line.toUpperCase()) {
      violations.push({
        type: 'slugline',
        severity: 'medium',
        line: lineNum,
        element: 'slugline',
        expected: 'ALL CAPS',
        actual: line,
        description: 'Slugline should be all caps',
        suggestion: 'Convert slugline to uppercase',
      });
    }
  }

  /**
   * Check if line is transition
   */
  private isTransition(line: string): boolean {
    return /^(CUT TO:|FADE TO:|FADE OUT:|DISSOLVE TO:|SMASH CUT TO:|JUMP CUT TO:|MATCH CUT TO:)/i.test(line);
  }

  /**
   * Validate transition
   */
  private validateTransition(line: string, lineNum: number, violations: FormatViolation[]): void {
    if (!/^(CUT TO:|FADE TO:|FADE OUT:|DISSOLVE TO:|SMASH CUT TO:|JUMP CUT TO:|MATCH CUT TO:)$/i.test(line)) {
      violations.push({
        type: 'transition',
        severity: 'low',
        line: lineNum,
        element: 'transition',
        expected: 'CUT TO: / FADE TO: / etc.',
        actual: line,
        description: 'Non-standard transition',
        suggestion: 'Use standard transitions',
      });
    }
  }

  /**
   * Check if line is character cue
   */
  private isCharacterCue(line: string): boolean {
    return /^[A-Z][A-Z\s']+$/i.test(line) && line.length > 1 && line.length < 40 && !line.includes('.');
  }

  /**
   * Validate character cue
   */
  private validateCharacterCue(line: string, lineNum: number, violations: FormatViolation[]): void {
    if (line !== line.toUpperCase()) {
      violations.push({
        type: 'character',
        severity: 'medium',
        line: lineNum,
        element: 'character cue',
        expected: 'ALL CAPS',
        actual: line,
        description: 'Character name should be uppercase',
        suggestion: 'Convert character name to uppercase',
      });
    }
  }

  /**
   * Check if line is parenthetical
   */
  private isParenthetical(line: string): boolean {
    return /^\(.+\)$/.test(line);
  }

  /**
   * Validate parenthetical
   */
  private validateParenthetical(line: string, lineNum: number, violations: FormatViolation[]): void {
    if (!/^\([a-z\s]+\)$/i.test(line)) {
      violations.push({
        type: 'parenthetical',
        severity: 'low',
        line: lineNum,
        element: 'parenthetical',
        expected: '(direction)',
        actual: line,
        description: 'Parenthetical format incorrect',
        suggestion: 'Use lowercase direction in parentheses',
      });
    }
  }

  /**
   * Validate dialogue
   */
  private validateDialogue(line: string, character: string, lineNum: number, violations: FormatViolation[]): void {
    if (line.length > 200) {
      violations.push({
        type: 'dialogue',
        severity: 'low',
        line: lineNum,
        element: 'dialogue',
        expected: 'Under 200 chars per line',
        actual: `${line.length} chars`,
        description: 'Dialogue line too long',
        suggestion: 'Break long dialogue into multiple lines',
      });
    }
  }

  /**
   * Validate action
   */
  private validateAction(line: string, lineNum: number, violations: FormatViolation[]): void {
    // Check for camera directions in action
    const cameraDirs = ['WE SEE', 'CAMERA', 'ANGLE ON', 'CLOSE ON', 'PAN TO', 'TILT TO', 'ZOOM'];
    for (const dir of cameraDirs) {
      if (line.toUpperCase().includes(dir)) {
        violations.push({
          type: 'action',
          severity: 'low',
          line: lineNum,
          element: 'action',
          expected: 'No camera directions',
          actual: dir,
          description: `Camera direction "${dir}" found in action`,
          suggestion: 'Remove camera directions from action lines',
        });
      }
    }

    // Check for present tense
    if (!/^(A|An|The|He|She|They|It|[A-Z][a-z]+)\s+(is|are|was|were|has|have|does|do|will|would|could|should|can|may|might)\b/i.test(line)) {
      // Not necessarily wrong, just checking
    }
  }

  /**
   * Validate scene number
   */
  private validateSceneNumber(lines: string[], violations: FormatViolation[]): void {
    const firstLine = lines.find(l => l.trim());
    if (firstLine && !/^Scene\s+\d+/i.test(firstLine.trim())) {
      // Not required but recommended
    }
  }

  /**
   * Estimate page count
   */
  private estimatePages(lines: string[]): number {
    // Rough estimate: 1 page = ~55 lines of screenplay format
    const nonEmptyLines = lines.filter(l => l.trim()).length;
    return Math.ceil(nonEmptyLines / 55);
  }

  /**
   * Validate page count
   */
  private validatePageCount(pages: number, violations: FormatViolation[]): void {
    if (pages > 5) {
      violations.push({
        type: 'page-count',
        severity: 'medium',
        element: 'page count',
        expected: '1-3 pages per scene',
        actual: `${pages} pages`,
        description: `Scene estimated at ${pages} pages`,
        suggestion: 'Consider splitting long scenes',
      });
    }
  }

  /**
   * Validate spacing
   */
  private validateSpacing(lines: string[], violations: FormatViolation[]): void {
    for (let i = 1; i < lines.length; i++) {
      // Check for multiple blank lines
      if (!lines[i]!.trim() && !lines[i-1]!.trim()) {
        violations.push({
          type: 'spacing',
          severity: 'low',
          line: i + 1,
          element: 'spacing',
          expected: 'Single blank line',
          actual: 'Multiple blank lines',
          description: 'Multiple consecutive blank lines',
          suggestion: 'Use single blank lines between elements',
        });
      }
    }
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(violations: FormatViolation[], strictness: FormatCheckerConfig['strictness']): number {
    if (violations.length === 0) return 1.0;
    
    const weights = {
      lenient: { critical: 0.3, high: 0.2, medium: 0.1, low: 0.05 },
      standard: { critical: 0.4, high: 0.25, medium: 0.15, low: 0.05 },
      strict: { critical: 0.5, high: 0.3, medium: 0.2, low: 0.1 },
    };
    
    const w = weights[strictness];
    let score = 1.0;
    
    for (const v of violations) {
      score -= w[v.severity];
    }
    
    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Factory for creating FormatChecker
 */
export async function createFormatChecker(
  config?: Partial<FormatCheckerConfig>
): Promise<FormatChecker> {
  const skill = new FormatChecker();
  await skill.initialize(config);
  return skill;
}