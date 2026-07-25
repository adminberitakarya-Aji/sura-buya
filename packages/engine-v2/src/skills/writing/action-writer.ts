/**
 * Suro-Buya Engine v2 - Action Writer Skill
 * 
 * Generates action descriptions and scene direction based on scene beats.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { WritingSkill } from '../base.js';
import type { SceneGenerationInput } from '../../types.js';

/**
 * Action Writer configuration
 */
export interface ActionWriterConfig extends Record<string, unknown> {
  /** Level of detail in action descriptions */
  detailLevel: 'minimal' | 'standard' | 'detailed';
  /** Whether to include sensory details */
  includeSensoryDetails: boolean;
  /** Whether to include camera directions */
  includeCameraDirections: boolean;
  /** Maximum action paragraphs per beat */
  maxParagraphsPerBeat: number;
  /** Action style: cinematic, literary, hybrid */
  style: 'cinematic' | 'literary' | 'hybrid';
}

/**
 * Action paragraph
 */
export interface ActionParagraph {
  /** The action text */
  text: string;
  /** Beat this action relates to */
  beatIndex: number;
  /** Sensory details included */
  sensoryDetails?: string[];
  /** Camera directions */
  cameraDirections?: string[];
}

/**
 * Action Writer output
 */
export interface ActionWriterOutput {
  /** Generated action paragraphs */
  actionParagraphs: ActionParagraph[];
  /** Summary of action flow */
  actionFlow: string;
  /** Pacing notes */
  pacingNotes: string[];
}

/**
 * Action Writer Skill
 * Generates vivid action descriptions for scenes
 */
export class ActionWriter extends WritingSkill<SceneGenerationInput, ActionWriterOutput> {
  override name = 'ActionWriter';
  override version = '1.0.0';
  override description = 'Generates vivid action descriptions and scene direction from story beats';
  override dependencies: string[] = ['ScreenplayFormatter'];
  override required = false;
  
  override configSchema = z.object({
    detailLevel: z.enum(['minimal', 'standard', 'detailed']).default('standard'),
    includeSensoryDetails: z.boolean().default(true),
    includeCameraDirections: z.boolean().default(false),
    maxParagraphsPerBeat: z.number().default(2),
    style: z.enum(['cinematic', 'literary', 'hybrid']).default('cinematic'),
  });

  override defaultConfig: Record<string, unknown> = {
    detailLevel: 'standard',
    includeSensoryDetails: true,
    includeCameraDirections: false,
    maxParagraphsPerBeat: 2,
    style: 'cinematic',
  };

  protected override config: ActionWriterConfig = {
    detailLevel: 'standard',
    includeSensoryDetails: true,
    includeCameraDirections: false,
    maxParagraphsPerBeat: 2,
    style: 'cinematic',
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<ActionWriterOutput>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const actionParagraphs: ActionParagraph[] = [];
      const pacingNotes: string[] = [];

      for (let i = 0; i < input.keyBeats.length; i++) {
        const beat = input.keyBeats[i] ?? '';
        const paragraphsForBeat = this.generateActionForBeat(
          beat, 
          input, 
          context, 
          i, 
          cfg.maxParagraphsPerBeat
        );
        
        actionParagraphs.push(...paragraphsForBeat);
        
        // Add pacing notes based on scene type and beat position
        if (i === 0) {
          pacingNotes.push('Opening beat - establish setting and tone');
        } else if (i === input.keyBeats.length - 1) {
          pacingNotes.push('Closing beat - resolve or cliffhanger');
        } else if (input.type === 'action' && i > input.keyBeats.length / 2) {
          pacingNotes.push('Action escalation - increase tempo');
        }
      }

      const actionFlow = this.generateActionFlow(actionParagraphs, input);
      
      const output: ActionWriterOutput = {
        actionParagraphs,
        actionFlow,
        pacingNotes,
      };

      return {
        success: true,
        data: output,
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
   * Generate action paragraphs for a single beat
   */
  private generateActionForBeat(
    beat: string,
    input: SceneGenerationInput,
    context: SkillContext,
    beatIndex: number,
    maxParagraphs: number
  ): ActionParagraph[] {
    const paragraphs: ActionParagraph[] = [];
    const paragraphCount = Math.min(maxParagraphs, this.getParagraphCountForBeat(beat, input.type));

    // Get location details for sensory enrichment
    const location = context.worldBibles[input.location];
    const locationDetails = location ? this.extractLocationDetails(location) : {};

    for (let p = 0; p < paragraphCount; p++) {
      const paragraph = this.constructActionParagraph(
        beat, 
        input, 
        context, 
        beatIndex, 
        p, 
        paragraphCount,
        locationDetails
      );
      paragraphs.push(paragraph);
    }

    return paragraphs;
  }

  /**
   * Determine number of paragraphs for a beat based on scene type
   */
  private getParagraphCountForBeat(beat: string, sceneType: SceneGenerationInput['type']): number {
    const baseCounts: Record<SceneGenerationInput['type'], number> = {
      action: 3,
      dialogue: 1,
      exposition: 2,
      climax: 3,
      resolution: 2,
      transition: 1,
    };
    return baseCounts[sceneType] || 2;
  }

  /**
   * Extract sensory details from location profile
   */
  private extractLocationDetails(worldProfile: { description?: string; geography?: { climate?: string; terrain?: string[]; landmarks?: string[] } }): Record<string, string[]> {
    const details: Record<string, string[]> = {
      visual: [],
      auditory: [],
      olfactory: [],
      tactile: [],
    };

    if (worldProfile.description) {
      // Extract visual cues from description
      const visualKeywords = ['bright', 'dark', 'dim', 'glowing', 'shadow', 'light', 'color', 'pale', 'vivid'];
      for (const keyword of visualKeywords) {
        if (worldProfile.description.toLowerCase().includes(keyword)) {
          (details['visual'] ??= []).push(keyword);
        }
      }
    }

    if (worldProfile.geography) {
      if (worldProfile.geography.climate) {
        (details['tactile'] ??= []).push(worldProfile.geography.climate);
      }
      if (worldProfile.geography.terrain) {
        (details['visual'] ??= []).push(...worldProfile.geography.terrain);
      }
    }

    return details;
  }

  /**
   * Construct a single action paragraph
   */
  private constructActionParagraph(
    beat: string,
    input: SceneGenerationInput,
    context: SkillContext,
    beatIndex: number,
    paragraphIndex: number,
    totalParagraphs: number,
    locationDetails: Record<string, string[]>
  ): ActionParagraph {
    const templates = this.getActionTemplates(input.type, beatIndex, input.keyBeats.length);
    const template = templates[paragraphIndex % templates.length] ?? '';

    // Build the action text
    let text = template
      .replace('{beat}', beat)
      .replace('{location}', input.location)
      .replace('{timeOfDay}', input.timeOfDay);

    // Add sensory details if enabled
    const sensoryDetails: string[] = [];
    if (this.config.includeSensoryDetails) {
      const details = this.addSensoryDetails(text, locationDetails, input.timeOfDay);
      text = details.text;
      sensoryDetails.push(...details.added);
    }

    // Add camera directions if enabled
    const cameraDirections: string[] = [];
    if (this.config.includeCameraDirections && this.config.style === 'cinematic') {
      const cameraDir = this.generateCameraDirection(beatIndex, input.keyBeats.length, paragraphIndex);
      if (cameraDir) {
        cameraDirections.push(cameraDir);
      }
    }

    return {
      text,
      beatIndex,
      sensoryDetails: sensoryDetails.length > 0 ? sensoryDetails : undefined,
      cameraDirections: cameraDirections.length > 0 ? cameraDirections : undefined,
    };
  }

  /**
   * Get action templates by scene type and beat position
   */
  private getActionTemplates(
    sceneType: SceneGenerationInput['type'],
    beatIndex: number,
    totalBeats: number
  ): string[] {
    const isOpening = beatIndex === 0;
    const isClosing = beatIndex === totalBeats - 1;
    const isMiddle = !isOpening && !isClosing;

    const templates: Record<SceneGenerationInput['type'], { opening: string[]; middle: string[]; closing: string[] }> = {
      action: {
        opening: [
          "The {timeOfDay} light cuts through {location} as {beat}.",
          "Tension coils in the air at {location} while {beat}.",
          "{beat} erupts in {location}, shattering the {timeOfDay} calm.",
        ],
        middle: [
          "Movement blurs as {beat}.",
          "Every instinct screams as {beat}.",
          "The space between heartbeats stretches while {beat}.",
        ],
        closing: [
          "Dust settles as {beat}.",
          "The echoes of {beat} fade into {timeOfDay} silence.",
          "In the aftermath of {beat}, {location} holds its breath.",
        ],
      },
      dialogue: {
        opening: [
          "{location} hums with the low murmur of {beat}.",
          "Characters settle into {location} as {beat} begins.",
          "The {timeOfDay} atmosphere in {location} sets the stage for {beat}.",
        ],
        middle: [
          "A pause stretches while {beat}.",
          "Gestures punctuate the air as {beat}.",
          "The conversation flows into {beat}.",
        ],
        closing: [
          "Silence follows {beat}, heavy with meaning.",
          "The weight of {beat} lingers in {location}.",
          "As {beat} concludes, {timeOfDay} deepens in {location}.",
        ],
      },
      exposition: {
        opening: [
          "{location} reveals its secrets as {beat}.",
          "The {timeOfDay} shadows in {location} part for {beat}.",
          "History breathes in {location} while {beat} unfolds.",
        ],
        middle: [
          "Layers peel back as {beat}.",
          "Each detail of {beat} adds to the picture.",
          "The narrative thread pulls tighter with {beat}.",
        ],
        closing: [
          "Understanding crystallizes from {beat}.",
          "The final piece of {beat} falls into place.",
          "{beat} completes the picture in {location}.",
        ],
      },
      climax: {
        opening: [
          "Everything converges on {location} as {beat}.",
          "The storm breaks with {beat} at {location}.",
          "Fate hangs on {beat} in the {timeOfDay} light.",
        ],
        middle: [
          "Maximum pressure as {beat}.",
          "No turning back from {beat}.",
          "The crescendo builds: {beat}.",
        ],
        closing: [
          "The peak shatters into {beat}.",
          "Release crashes through as {beat}.",
          "After {beat}, nothing will be the same.",
        ],
      },
      resolution: {
        opening: [
          "Calm returns to {location} after {beat}.",
          "The {timeOfDay} brings perspective to {beat}.",
          "Settling into the new normal: {beat}.",
        ],
        middle: [
          "Loose threads tie off as {beat}.",
          "Reflection settles over {beat}.",
          "The cost of {beat} becomes clear.",
        ],
        closing: [
          "{location} exhales as {beat} concludes.",
          "Final notes of {beat} fade into {timeOfDay}.",
          "Peace, fragile and earned, follows {beat}.",
        ],
      },
      transition: {
        opening: [
          "The scene shifts as {beat}.",
          "{location} dissolves into {beat}.",
          "A bridge forms: {beat}.",
        ],
        middle: [
          "Momentum carries through {beat}.",
          "The transition deepens with {beat}.",
        ],
        closing: [
          "New ground solidifies after {beat}.",
          "The way forward clears from {beat}.",
        ],
      },
    };

    const sceneTemplates = templates[sceneType] || templates.exposition;
    const positionKey = isOpening ? 'opening' : isClosing ? 'closing' : 'middle';
    return sceneTemplates[positionKey];
  }

  /**
   * Add sensory details to action text
   */
  private addSensoryDetails(
    text: string,
    locationDetails: Record<string, string[]>,
    timeOfDay: string
  ): { text: string; added: string[] } {
    const added: string[] = [];
    let enhancedText = text;

    // Time-based sensory details
    const timeDetails: Record<string, string[]> = {
      dawn: ['cool air', 'dew', 'birdsong', 'pale light'],
      morning: ['bright light', 'fresh air', 'activity sounds'],
      noon: ['harsh light', 'heat', 'peak activity'],
      afternoon: ['warm light', 'long shadows', 'settling rhythm'],
      evening: ['golden light', 'cooling air', 'evening sounds'],
      dusk: ['fading light', 'shadows lengthening', 'quiet settling'],
      night: ['darkness', 'artificial light', 'night sounds', 'cool air'],
      midnight: ['deep darkness', 'silence', 'cold air'],
    };

    const timeKey = timeOfDay.toLowerCase();
    const timeSensory = timeDetails[timeKey] ?? timeDetails['evening'] ?? [];

    // Add one sensory detail if not already present
    const hasSensory = /(smell|sound|feel|touch|taste|see|hear|scent|aroma)/i.test(text);
    if (!hasSensory && timeSensory.length > 0) {
      const detail = timeSensory[Math.floor(Math.random() * timeSensory.length)];
      if (detail) {
        enhancedText = `${text} The ${detail} permeates the space.`;
        added.push(detail);
      }
    }

    // Add location-specific sensory details
    if ((locationDetails['visual'] ?? []).length > 0 && Math.random() < 0.3) {
      const visual = (locationDetails['visual'] ?? [])[0];
      if (visual) {
        enhancedText += ` Visual notes of ${visual} stand out.`;
        added.push(`visual: ${visual}`);
      }
    }

    return { text: enhancedText, added };
  }

  /**
   * Generate camera direction for cinematic style
   */
  private generateCameraDirection(
    beatIndex: number,
    totalBeats: number,
    paragraphIndex: number
  ): string | null {
    const directions = [
      'WIDE SHOT establishes the space',
      'CLOSE UP on key detail',
      'TRACKING SHOT follows movement',
      'LOW ANGLE emphasizes power',
      'HIGH ANGLE shows vulnerability',
      'RACK FOCUS shifts attention',
      'DOLLY IN intensifies moment',
      'WHIP PAN to next action',
    ];

    // More camera directions for opening/closing beats
    if (beatIndex === 0 || beatIndex === totalBeats - 1) {
      const dir = directions[paragraphIndex % directions.length];
      return dir ?? null;
    }

    // Occasional camera directions for middle beats
    if (Math.random() < 0.3) {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      return dir ?? null;
    }

    return null;
  }

  /**
   * Generate action flow summary
   */
  private generateActionFlow(
    paragraphs: ActionParagraph[],
    input: SceneGenerationInput
  ): string {
    const beatCount = input.keyBeats.length;
    const paragraphCount = paragraphs.length;
    
    let flow = `Scene ${input.sceneNumber} (${input.type}): ${paragraphCount} action paragraphs across ${beatCount} beats. `;
    
    if (input.type === 'action') {
      flow += 'High-energy physical sequence with escalating intensity. ';
    } else if (input.type === 'dialogue') {
      flow += 'Character-driven with minimal physical action. ';
    } else if (input.type === 'climax') {
      flow += 'Peak tension sequence building to decisive moment. ';
    }

    flow += `Setting: ${input.location} at ${input.timeOfDay}. `;
    flow += `Characters present: ${input.characters.join(', ')}.`;

    return flow;
  }
}

/**
 * Factory for creating ActionWriter
 */
export async function createActionWriter(
  config?: Partial<ActionWriterConfig>
): Promise<ActionWriter> {
  const skill = new ActionWriter();
  await skill.initialize(config);
  return skill;
}