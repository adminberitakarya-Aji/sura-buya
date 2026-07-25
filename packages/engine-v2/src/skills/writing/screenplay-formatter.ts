/**
 * Suro-Buya Engine v2 - Screenplay Formatter Skill
 * 
 * Formats generated content into proper screenplay format.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { WritingSkill } from '../base.js';
import type { SceneData, SceneGenerationInput } from '../../types.js';

/**
 * Screenplay formatting options
 */
export interface ScreenplayFormatterConfig extends Record<string, unknown> {
  /** Include scene headings */
  includeSceneHeadings: boolean;
  /** Include action lines */
  includeActionLines: boolean;
  /** Include character names in dialogue */
  includeCharacterNames: boolean;
  /** Include parentheticals */
  includeParentheticals: boolean;
  /** Include transitions */
  includeTransitions: boolean;
  /** Page width for formatting */
  pageWidth: number;
  /** Use standard screenplay margins */
  standardMargins: boolean;
}

/**
 * Screenplay element types
 */
export type ScreenplayElementType = 
  | 'scene-heading' 
  | 'action' 
  | 'character' 
  | 'dialogue' 
  | 'parenthetical' 
  | 'transition' 
  | 'shot';

/**
 * Screenplay element
 */
export interface ScreenplayElement {
  type: ScreenplayElementType;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Formatted screenplay output
 */
export interface FormattedScreenplay {
  /** Raw screenplay text */
  text: string;
  /** Structured elements */
  elements: ScreenplayElement[];
  /** Scene metadata */
  sceneInfo: {
    sceneNumber: number;
    location: string;
    timeOfDay: string;
    characters: string[];
  };
}

/**
 * Screenplay Formatter Skill
 * Converts structured scene output into properly formatted screenplay text
 */
export class ScreenplayFormatter extends WritingSkill<SceneGenerationInput, FormattedScreenplay> {
  override name = 'ScreenplayFormatter';
  override version = '1.0.0';
  override description = 'Formats generated scene content into standard screenplay format';
  override dependencies: string[] = [];
  override required = true;
  
  override configSchema = z.object({
    includeSceneHeadings: z.boolean().default(true),
    includeActionLines: z.boolean().default(true),
    includeCharacterNames: z.boolean().default(true),
    includeParentheticals: z.boolean().default(true),
    includeTransitions: z.boolean().default(true),
    pageWidth: z.number().default(80),
    standardMargins: z.boolean().default(true),
  });

  override defaultConfig: Record<string, unknown> = {
    includeSceneHeadings: true,
    includeActionLines: true,
    includeCharacterNames: true,
    includeParentheticals: true,
    includeTransitions: true,
    pageWidth: 80,
    standardMargins: true,
  };

  protected override config: ScreenplayFormatterConfig = {
    includeSceneHeadings: true,
    includeActionLines: true,
    includeCharacterNames: true,
    includeParentheticals: true,
    includeTransitions: true,
    pageWidth: 80,
    standardMargins: true,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<FormattedScreenplay>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const elements: ScreenplayElement[] = [];
      const lines: string[] = [];

      // Scene heading
      if (cfg.includeSceneHeadings) {
        const sceneHeading = this.formatSceneHeading(input);
        elements.push({ type: 'scene-heading', content: sceneHeading });
        lines.push(sceneHeading);
        lines.push(''); // Blank line after scene heading
      }

      // Action lines from key beats
      if (cfg.includeActionLines && input.keyBeats.length > 0) {
        for (const beat of input.keyBeats) {
          const actionLines = this.formatActionLines(beat);
          for (const actionLine of actionLines) {
            elements.push({ type: 'action', content: actionLine });
            lines.push(actionLine);
            lines.push(''); // Blank line after action
          }
        }
      }

      // Dialogue (if characters present and not pure action)
      if (input.characters.length > 0 && input.type !== 'action') {
        // This would be populated by DialogueWriter skill in practice
        // For now, add placeholder dialogue structure
        const dialogueElements = this.generatePlaceholderDialogue(input, context);
        for (const elem of dialogueElements) {
          elements.push(elem);
          if (elem.type === 'character') {
            lines.push(elem.content);
          } else if (elem.type === 'parenthetical') {
            lines.push(`(${elem.content})`);
          } else if (elem.type === 'dialogue') {
            lines.push(elem.content);
          }
          lines.push(''); // Blank line after dialogue
        }
      }

      // Transition
      if (cfg.includeTransitions) {
        const transition = this.getTransitionForSceneType(input.type);
        elements.push({ type: 'transition', content: transition });
        lines.push(transition);
      }

      const formatted: FormattedScreenplay = {
        text: lines.join('\n').trim() + '\n',
        elements,
        sceneInfo: {
          sceneNumber: input.sceneNumber,
          location: input.location,
          timeOfDay: input.timeOfDay,
          characters: input.characters,
        },
      };

      return {
        success: true,
        data: formatted,
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
   * Format scene heading (slugline)
   */
  private formatSceneHeading(input: SceneGenerationInput): string {
    const timeOfDay = input.timeOfDay.toUpperCase();
    const location = input.location.toUpperCase();
    return `SCENE ${input.sceneNumber}: ${location} - ${timeOfDay}`;
  }

  /**
   * Format action lines from beat description
   */
  private formatActionLines(beat: string): string[] {
    // Split long beats into multiple action lines
    const maxLineLength = this.config.pageWidth - 10; // Account for margins
    const words = beat.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length > maxLineLength && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += (currentLine ? ' ' : '') + word;
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    return lines.length > 0 ? lines : [beat];
  }

  /**
   * Generate placeholder dialogue structure
   */
  private generatePlaceholderDialogue(
    input: SceneGenerationInput, 
    context: SkillContext
  ): ScreenplayElement[] {
    const elements: ScreenplayElement[] = [];
    
    for (const charId of input.characters) {
      const character = context.characterBibles[charId];
      if (!character) continue;

      const charName = character.name.toUpperCase();
      
      // Character name
      elements.push({ type: 'character', content: charName });
      
      // Parenthetical (optional)
      if (this.config.includeParentheticals && character.voice?.tone) {
        elements.push({ 
          type: 'parenthetical', 
          content: character.voice.tone 
        });
      }
      
      // Dialogue placeholder
      elements.push({ 
        type: 'dialogue', 
        content: `[Dialogue for ${character.name}]` 
      });
    }

    return elements;
  }

  /**
   * Get appropriate transition for scene type
   */
  private getTransitionForSceneType(type: SceneGenerationInput['type']): string {
    const transitions: Record<SceneGenerationInput['type'], string> = {
      dialogue: 'CUT TO:',
      action: 'CUT TO:',
      exposition: 'DISSOLVE TO:',
      climax: 'CUT TO:',
      resolution: 'FADE OUT.',
      transition: 'SMASH CUT TO:',
    };
    return transitions[type] || 'CUT TO:';
  }
}

/**
 * Factory for creating ScreenplayFormatter
 */
export async function createScreenplayFormatter(
  config?: Partial<ScreenplayFormatterConfig>
): Promise<ScreenplayFormatter> {
  const skill = new ScreenplayFormatter();
  await skill.initialize(config);
  return skill;
}