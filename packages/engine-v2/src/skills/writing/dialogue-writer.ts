/**
 * Suro-Buya Engine v2 - Dialogue Writer Skill
 * 
 * Generates character dialogue based on scene context and character voices.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { WritingSkill } from '../base.js';
import type { SceneGenerationInput, CharacterProfile } from '../../types.js';

/**
 * Dialogue Writer configuration
 */
export interface DialogueWriterConfig extends Record<string, unknown> {
  /** Maximum dialogue lines per character per scene */
  maxLinesPerCharacter: number;
  /** Whether to include subtext in dialogue */
  includeSubtext: boolean;
  /** Whether to use character catchphrases */
  useCatchphrases: boolean;
  /** Dialogue style: naturalistic, stylized, theatrical */
  style: 'naturalistic' | 'stylized' | 'theatrical';
  /** Minimum dialogue lines to generate */
  minDialogueLines: number;
}

/**
 * Dialogue line with metadata
 */
export interface DialogueLine {
  /** Character ID */
  characterId: string;
  /** Character name */
  characterName: string;
  /** The dialogue text */
  text: string;
  /** Parenthetical direction */
  parenthetical?: string;
  /** Emotional tone */
  tone?: string;
  /** Subtext */
  subtext?: string;
}

/**
 * Dialogue Writer output
 */
export interface DialogueWriterOutput {
  /** Generated dialogue lines */
  dialogue: DialogueLine[];
  /** Dialogue beats structure */
  beats: Array<{
    characterId: string;
    intent: string;
    emotionalArc: 'escalating' | 'de-escalating' | 'stable';
  }>;
}

/**
 * Dialogue Writer Skill
 * Generates character-appropriate dialogue for scenes
 */
export class DialogueWriter extends WritingSkill<SceneGenerationInput, DialogueWriterOutput> {
  override name = 'DialogueWriter';
  override version = '1.0.0';
  override description = 'Generates character-appropriate dialogue based on scene context and character voices';
  override dependencies: string[] = ['ScreenplayFormatter'];
  override required = false;
  
  override configSchema = z.object({
    maxLinesPerCharacter: z.number().default(5),
    includeSubtext: z.boolean().default(true),
    useCatchphrases: z.boolean().default(true),
    style: z.enum(['naturalistic', 'stylized', 'theatrical']).default('naturalistic'),
    minDialogueLines: z.number().default(3),
  });

  override defaultConfig: Record<string, unknown> = {
    maxLinesPerCharacter: 5,
    includeSubtext: true,
    useCatchphrases: true,
    style: 'naturalistic',
    minDialogueLines: 3,
  };

  protected override config: DialogueWriterConfig = {
    maxLinesPerCharacter: 5,
    includeSubtext: true,
    useCatchphrases: true,
    style: 'naturalistic',
    minDialogueLines: 3,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<DialogueWriterOutput>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const dialogue: DialogueLine[] = [];
      const beats: DialogueWriterOutput['beats'] = [];

      for (const charId of input.characters) {
        const character = context.characterBibles[charId];
        if (!character) continue;

        const linesForCharacter = Math.min(
          cfg.maxLinesPerCharacter,
          Math.max(cfg.minDialogueLines, Math.floor(input.keyBeats.length / input.characters.length) + 1)
        );

        for (let i = 0; i < linesForCharacter; i++) {
          const beatIndex = Math.min(i, input.keyBeats.length - 1);
          const beat = input.keyBeats[beatIndex] ?? '';
          
          const dialogueLine = this.generateDialogueLine(character, beat, input, context, i, linesForCharacter);
          dialogue.push(dialogueLine);
        }

        beats.push({
          characterId: character.id,
          intent: this.inferCharacterIntent(character, input),
          emotionalArc: this.determineEmotionalArc(character, input),
        });
      }

      const output: DialogueWriterOutput = { dialogue, beats };

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
   * Generate a single dialogue line for a character
   */
  private generateDialogueLine(
    character: CharacterProfile,
    beat: string,
    input: SceneGenerationInput,
    context: SkillContext,
    lineIndex: number,
    totalLines: number
  ): DialogueLine {
    const tone = character.voice?.tone || 'neutral';
    const vocabulary = character.voice?.vocabulary || [];
    const speechPatterns = character.voice?.speechPatterns || [];
    const catchphrases = character.voice?.catchphrases || [];

    // Build dialogue based on character voice
    let text = this.constructDialogueText(character, beat, input, lineIndex, totalLines);

    // Add catchphrase if applicable
    if (this.config.useCatchphrases && catchphrases.length > 0 && Math.random() < 0.2) {
      const catchphrase = catchphrases[Math.floor(Math.random() * catchphrases.length)];
      text = `${text} ${catchphrase}`;
    }

    // Determine parenthetical based on emotional state
    const parenthetical = this.determineParenthetical(character, beat, lineIndex, totalLines) || undefined;

    // Generate subtext if enabled
    const subtext = this.config.includeSubtext 
      ? this.generateSubtext(character, beat, input)
      : undefined;

    return {
      characterId: character.id,
      characterName: character.name,
      text,
      parenthetical,
      tone,
      subtext,
    };
  }

  /**
   * Construct dialogue text based on character and scene
   */
  private constructDialogueText(
    character: CharacterProfile,
    beat: string,
    input: SceneGenerationInput,
    lineIndex: number,
    totalLines: number
  ): string {
    const templates = this.getDialogueTemplates(character.archetype, input.type);
    const template = templates[lineIndex % templates.length] ?? '';
    
    // Replace placeholders
    let text = template
      .replace('{beat}', beat)
      .replace('{character}', character.name)
      .replace('{location}', input.location)
      .replace('{timeOfDay}', input.timeOfDay);

    // Apply speech patterns
    for (const pattern of character.voice?.speechPatterns || []) {
      if (Math.random() < 0.3) {
        text = this.applySpeechPattern(text, pattern);
      }
    }

    // Apply vocabulary
    const vocab = character.voice?.vocabulary || [];
    if (vocab.length > 0 && Math.random() < 0.4) {
      const word = vocab[Math.floor(Math.random() * vocab.length)];
      if (word) {
        text = this.injectVocabulary(text, word);
      }
    }

    return text;
  }

  /**
   * Get dialogue templates by archetype and scene type
   */
  private getDialogueTemplates(archetype: CharacterProfile['archetype'], sceneType: SceneGenerationInput['type']): string[] {
    const baseTemplates = {
      protagonist: [
        "We need to {beat}.",
        "I can't believe {beat}.",
        "{beat}... this changes everything.",
        "If we don't {beat}, we'll lose everything.",
      ],
      antagonist: [
        "You think {beat} will stop me?",
        "{beat}... how predictable.",
        "While you worry about {beat}, I've already won.",
        "Your {beat} means nothing to me.",
      ],
      mentor: [
        "Remember, {beat}.",
        "The key to {beat} is patience.",
        "I've seen {beat} before. Trust me.",
        "When you face {beat}, remember your training.",
      ],
      sidekick: [
        "So... {beat}?",
        "Uh, {beat}? That's the plan?",
        "I'm with you on {beat}!",
        "{beat}... okay, that's actually terrifying.",
      ],
      'love-interest': [
        "Is it true about {beat}?",
        "{beat}... you're not telling me everything.",
        "We need to talk about {beat}.",
        "After {beat}, nothing will be the same between us.",
      ],
      rival: [
        "Hmph. {beat}? I could do better.",
        "{beat} won't save you this time.",
        "You call that {beat}? Pathetic.",
        "We'll see about {beat}.",
      ],
      'comic-relief': [
        "So {beat}, huh? *nervous laugh*",
        "Okay, {beat}... but what if we just... didn't?",
        "{beat}! *dramatic gasp* Not again!",
        "Note to self: {beat} equals bad idea.",
      ],
      mysterious: [
        "{beat}...",
        "The {beat} holds more than you know.",
        "You ask about {beat}? Dangerous questions.",
        "{beat} is merely the beginning.",
      ],
      guardian: [
        "I won't let {beat} harm anyone.",
        "{beat}... my duty is clear.",
        "Stand down. {beat} is under my protection.",
        "Whatever {beat} brings, I'll face it.",
      ],
      trickster: [
        "Oh, {beat}? *wink* That's just what they want you to think.",
        "{beat}... or is it?",
        "You fell for {beat}? Classic.",
        "The truth about {beat}? That'll cost you.",
      ],
    };

    return baseTemplates[archetype] || baseTemplates.protagonist;
  }

  /**
   * Apply speech pattern to text
   */
  private applySpeechPattern(text: string, pattern: string): string {
    const patterns: Record<string, (t: string) => string> = {
      'stutters': (t) => t.split(' ').map((w, i) => i === 0 ? `${w[0]}-${w}` : w).join(' '),
      'formal': (t) => t.replace(/\b(can't|won't|don't|isn't)\b/gi, m => m.replace("n't", " not")),
      'slang': (t) => t.replace(/\b(yes|no|okay|sure)\b/gi, m => m.toLowerCase() === 'yes' ? 'yeah' : m.toLowerCase() === 'no' ? 'nah' : 'cool'),
      'philosophical': (t) => `${t} One might say...`,
      'terse': (t) => t.split('.')[0] + '.',
      'rambling': (t) => `${t} I mean, not that it matters, but...`,
    };

    return patterns[pattern] ? patterns[pattern](text) : text;
  }

  /**
   * Inject vocabulary word naturally
   */
  private injectVocabulary(text: string, word: string): string {
    const insertPoints = text.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (insertPoints.length === 0) return text;
    
    const idx = Math.floor(Math.random() * insertPoints.length);
    const point = insertPoints[idx] ?? '';
    insertPoints[idx] = `${point.trim()}, ${word}`;
    return insertPoints.join('. ') + '.';
  }

  /**
   * Determine parenthetical direction
   */
  private determineParenthetical(
    character: CharacterProfile,
    beat: string,
    lineIndex: number,
    totalLines: number
  ): string | undefined {
    const emotions = ['calm', 'urgent', 'frustrated', 'hopeful', 'angry', 'sad', 'determined', 'confused'];
    const archetypeEmotions: Record<string, string[]> = {
      protagonist: ['determined', 'urgent', 'hopeful'],
      antagonist: ['calm', 'angry', 'determined'],
      mentor: ['calm', 'hopeful'],
      sidekick: ['confused', 'hopeful', 'frustrated'],
      'love-interest': ['hopeful', 'sad', 'determined'],
      rival: ['angry', 'determined', 'calm'],
      'comic-relief': ['frustrated', 'confused'],
      mysterious: ['calm', 'determined'],
      guardian: ['determined', 'calm'],
      trickster: ['calm', 'determined'],
    };

    const charEmotions = archetypeEmotions[character.archetype] || emotions;
    const emotion = charEmotions[lineIndex % charEmotions.length];
    
    // Only add parenthetical sometimes
    if (Math.random() < 0.4) return undefined;
    return emotion;
  }

  /**
   * Generate subtext for dialogue
   */
  private generateSubtext(
    character: CharacterProfile,
    beat: string,
    input: SceneGenerationInput
  ): string {
    const subtexts = [
      `Hiding fear about ${beat}`,
      `Testing loyalty regarding ${beat}`,
      `Masking true feelings about ${beat}`,
      `Manipulating perception of ${beat}`,
      `Seeking validation for ${beat}`,
    ];
    return subtexts[Math.floor(Math.random() * subtexts.length)] ?? '';
  }

  /**
   * Infer character intent in scene
   */
  private inferCharacterIntent(character: CharacterProfile, input: SceneGenerationInput): string {
    const intents: Record<string, string[]> = {
      protagonist: ['achieve goal', 'protect others', 'discover truth'],
      antagonist: ['defeat protagonist', 'achieve own goal', 'maintain control'],
      mentor: ['guide protagonist', 'impart wisdom', 'prepare for challenge'],
      sidekick: ['support protagonist', 'provide comic relief', 'learn'],
      'love-interest': ['connect emotionally', 'challenge protagonist', 'reveal vulnerability'],
      rival: ['prove superiority', 'compete with protagonist', 'win'],
      'comic-relief': ['lighten mood', 'provide perspective', 'survive'],
      mysterious: ['conceal information', 'observe', 'manipulate events'],
      guardian: ['protect charge', 'maintain order', 'uphold duty'],
      trickster: ['create chaos', 'reveal truth through deception', 'amuse self'],
    };
    
    const charIntents = intents[character.archetype] ?? intents['protagonist'] ?? ['achieve goal'];
    return charIntents[Math.floor(Math.random() * charIntents.length)] ?? 'achieve goal';
  }

  /**
   * Determine emotional arc for character in scene
   */
  private determineEmotionalArc(
    character: CharacterProfile,
    input: SceneGenerationInput
  ): 'escalating' | 'de-escalating' | 'stable' {
    const arcs: Record<string, ('escalating' | 'de-escalating' | 'stable')[]> = {
      protagonist: ['escalating', 'escalating', 'stable'],
      antagonist: ['stable', 'escalating'],
      mentor: ['stable', 'de-escalating'],
      sidekick: ['escalating', 'stable'],
      'love-interest': ['escalating', 'stable'],
      rival: ['escalating'],
      'comic-relief': ['stable', 'de-escalating'],
      mysterious: ['stable'],
      guardian: ['stable'],
      trickster: ['stable', 'escalating'],
    };
    
    const charArcs = arcs[character.archetype] ?? ['stable'];
    return charArcs[Math.floor(Math.random() * charArcs.length)] ?? 'stable';
  }
}

/**
 * Factory for creating DialogueWriter
 */
export async function createDialogueWriter(
  config?: Partial<DialogueWriterConfig>
): Promise<DialogueWriter> {
  const skill = new DialogueWriter();
  await skill.initialize(config);
  return skill;
}