/**
 * Suro-Buya Engine v2 - Consistency Auditor Skill
 * 
 * Audits content for internal consistency across characters, plot, world, and timeline.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { ValidationSkill } from '../base.js';
import type { CharacterProfile, WorldProfile, EpisodeStructure, SceneData, StoryProfile, UniverseConfig } from '../../types.js';

/**
 * Consistency issue
 */
export interface ConsistencyIssue {
  type: 'character' | 'plot' | 'world' | 'timeline' | 'dialogue' | 'action' | 'detail';
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  message: string;
  location?: {
    scene?: number;
    paragraph?: number;
    offset?: number;
  };
  expected?: string;
  actual?: string;
  suggestion?: string;
  references?: string[];
}

/**
 * Consistency audit result
 */
export interface ConsistencyAuditResult {
  valid: boolean;
  issues: ConsistencyIssue[];
  summary: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  scores: {
    characterConsistency: number;
    plotConsistency: number;
    worldConsistency: number;
    timelineConsistency: number;
    overall: number;
  };
  checkedElements: {
    charactersTracked: number;
    plotPointsVerified: number;
    worldFactsChecked: number;
    timelineEventsValidated: number;
  };
}

/**
 * Configuration for ConsistencyAuditor
 */
export const ConsistencyAuditorConfigSchema = z.object({
  checkCharacterConsistency: z.boolean().default(true),
  checkPlotConsistency: z.boolean().default(true),
  checkWorldConsistency: z.boolean().default(true),
  checkTimelineConsistency: z.boolean().default(true),
  checkDialogueConsistency: z.boolean().default(true),
  checkActionConsistency: z.boolean().default(true),
  checkDetailContinuity: z.boolean().default(true),
  maxIssues: z.number().default(50),
  passingThreshold: z.number().min(0).max(1).default(0.8),
  trackCharacterStates: z.boolean().default(true),
  trackWorldState: z.boolean().default(true),
});

export type ConsistencyAuditorConfig = z.infer<typeof ConsistencyAuditorConfigSchema>;

/**
 * Internal state tracking for characters
 */
interface CharacterState {
  id: string;
  name: string;
  location?: string;
  emotionalState?: string;
  physicalState?: string;
  knowledge: Set<string>;
  possessions: Set<string>;
  relationships: Map<string, string>;
  lastSeenScene?: number;
  traits: string[];
  abilities: string[];
  weaknesses: string[];
}

/**
 * Internal state tracking for world
 */
interface WorldState {
  currentLocation?: string;
  currentTime?: string;
  activeCharacters: Set<string>;
  knownFacts: Set<string>;
  establishedEvents: Set<string>;
}

/**
 * ConsistencyAuditor Skill - Audits content for internal consistency
 */
export class ConsistencyAuditor extends ValidationSkill<string, ConsistencyAuditResult> {
  override name = 'ConsistencyAuditor';
  override version = '1.0.0';
  override description = 'Audits content for internal consistency across characters, plot, world, and timeline';
  override category = 'audit' as const;
  override dependencies = ['CanonValidator', 'ContinuityGuard'];
  override required = true;
  override configSchema = ConsistencyAuditorConfigSchema;
  override defaultConfig: ConsistencyAuditorConfig = {
    checkCharacterConsistency: true,
    checkPlotConsistency: true,
    checkWorldConsistency: true,
    checkTimelineConsistency: true,
    checkDialogueConsistency: true,
    checkActionConsistency: true,
    checkDetailContinuity: true,
    maxIssues: 50,
    passingThreshold: 0.8,
    trackCharacterStates: true,
    trackWorldState: true,
  };

  protected override config: ConsistencyAuditorConfig = this.defaultConfig;
  private characterStates: Map<string, CharacterState> = new Map();
  private worldState: WorldState = {
    activeCharacters: new Set(),
    knownFacts: new Set(),
    establishedEvents: new Set(),
  };
  private plotPoints: Map<string, { established: boolean; resolved?: boolean; scenes: number[] }> = new Map();

  override async initialize(config?: Record<string, unknown>): Promise<void> {
    this.config = { ...this.defaultConfig, ...config } as ConsistencyAuditorConfig;
    const result = this.configSchema.safeParse(this.config);
    if (!result.success) {
      throw new Error(`Invalid config for ${this.name}: ${result.error.message}`);
    }
    this.resetState();
  }

  private resetState(): void {
    this.characterStates.clear();
    this.worldState = {
      activeCharacters: new Set(),
      knownFacts: new Set(),
      establishedEvents: new Set(),
    };
    this.plotPoints.clear();
  }

  async validate(input: string, context: SkillContext): Promise<SkillResult<ConsistencyAuditResult>> {
    this.resetState();
    
    // Initialize states from context
    this.initializeStates(context);

    const issues: ConsistencyIssue[] = [];

    try {
      // Check character consistency
      if (this.config.checkCharacterConsistency && context.characterBibles) {
        const charIssues = await this.checkCharacterConsistency(input, context);
        issues.push(...charIssues);
      }

      // Check plot consistency
      if (this.config.checkPlotConsistency) {
        const plotIssues = await this.checkPlotConsistency(input, context);
        issues.push(...plotIssues);
      }

      // Check world consistency
      if (this.config.checkWorldConsistency && context.worldBibles) {
        const worldIssues = await this.checkWorldConsistency(input, context);
        issues.push(...worldIssues);
      }

      // Check timeline consistency
      if (this.config.checkTimelineConsistency && context.worldBibles) {
        const timelineIssues = await this.checkTimelineConsistency(input, context);
        issues.push(...timelineIssues);
      }

      // Check dialogue consistency
      if (this.config.checkDialogueConsistency && context.characterBibles) {
        const dialogueIssues = await this.checkDialogueConsistency(input, context);
        issues.push(...dialogueIssues);
      }

      // Check action consistency
      if (this.config.checkActionConsistency) {
        const actionIssues = await this.checkActionConsistency(input, context);
        issues.push(...actionIssues);
      }

      // Check detail continuity
      if (this.config.checkDetailContinuity) {
        const detailIssues = await this.checkDetailContinuity(input, context);
        issues.push(...detailIssues);
      }

      // Sort by severity
      const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
      issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // Limit issues
      const limitedIssues = issues.slice(0, this.config.maxIssues);

      const summary = {
        critical: limitedIssues.filter(i => i.severity === 'critical').length,
        major: limitedIssues.filter(i => i.severity === 'major').length,
        minor: limitedIssues.filter(i => i.severity === 'minor').length,
        info: limitedIssues.filter(i => i.severity === 'info').length,
      };

      // Calculate scores
      const scores = this.calculateScores(limitedIssues, context);

      const checkedElements = {
        charactersTracked: this.characterStates.size,
        plotPointsVerified: this.plotPoints.size,
        worldFactsChecked: this.worldState.knownFacts.size,
        timelineEventsValidated: this.worldState.establishedEvents.size,
      };

      const result: ConsistencyAuditResult = {
        valid: summary.critical === 0 && summary.major === 0 && scores.overall >= this.config.passingThreshold,
        issues: limitedIssues,
        summary,
        scores,
        checkedElements,
      };

      return {
        success: true,
        data: result,
        metadata: {
          skillName: this.name,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
        warnings: limitedIssues
          .filter(i => i.severity === 'major' || i.severity === 'critical')
          .map(i => i.message),
      };
    } catch (error) {
      return {
        success: false,
        error: `Consistency audit failed: ${(error as Error).message}`,
        metadata: {
          skillName: this.name,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          skipped: false,
        },
      };
    }
  }

  override async execute(input: string, context: SkillContext): Promise<SkillResult<ConsistencyAuditResult>> {
    return this.validate(input, context);
  }

  /**
   * Initialize internal states from context
   */
  private initializeStates(context: SkillContext): void {
    // Initialize character states
    if (context.characterBibles && this.config.trackCharacterStates) {
      for (const [charId, bible] of Object.entries(context.characterBibles)) {
        this.characterStates.set(charId, {
          id: charId,
          name: bible.name,
          knowledge: new Set(),
          possessions: new Set(),
          relationships: new Map(),
          traits: bible.traits || [],
          abilities: bible.abilities || [],
          weaknesses: bible.weaknesses || [],
        });
        
        // Extract knowledge from backstory, traits, etc.
        if (bible.backstory) {
          const words = bible.backstory.toLowerCase().split(/\s+/).filter(w => w.length > 4);
          for (const word of words.slice(0, 20)) {
            this.characterStates.get(charId)!.knowledge.add(word);
          }
        }
        
        // Extract from voice vocabulary
        if (bible.voice?.vocabulary) {
          for (const vocab of bible.voice.vocabulary) {
            this.characterStates.get(charId)!.knowledge.add(vocab.toLowerCase());
          }
        }
      }
    }

    // Initialize world state
    if (context.worldBibles && this.config.trackWorldState) {
      for (const [worldId, worldBible] of Object.entries(context.worldBibles)) {
        if (worldBible.history?.timeline) {
          for (const era of worldBible.history.timeline) {
            for (const event of era.events || []) {
              this.worldState.establishedEvents.add(event);
            }
          }
        }
        if (worldBible.history?.keyEvents) {
          for (const event of worldBible.history.keyEvents) {
            this.worldState.establishedEvents.add(event);
          }
        }
      }
    }

    // Initialize plot points from story profile
    if (context.storyProfile) {
      for (const plotPoint of context.storyProfile.plotPoints || []) {
        this.plotPoints.set(plotPoint.description, { established: false, scenes: [] });
      }
      if (context.storyProfile.structure?.beats) {
        for (const beat of context.storyProfile.structure.beats) {
          this.plotPoints.set(beat, { established: false, scenes: [] });
        }
      }
    }
  }

  /**
   * Check character consistency
   */
  private async checkCharacterConsistency(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const contentLower = input.toLowerCase();

    for (const [charId, state] of this.characterStates) {
      const bible = context.characterBibles?.[charId];
      if (!bible) continue;

      // Check if character is mentioned
      if (!contentLower.includes(bible.name.toLowerCase())) continue;

      // Check trait consistency - character should act according to traits
      for (const trait of state.traits) {
        const traitLower = trait.toLowerCase();
        // If trait is mentioned in content, verify it aligns
        if (contentLower.includes(traitLower)) {
          // Check for contradictory behavior
          const opposites: Record<string, string[]> = {
            'brave': ['cowardly', 'fearful', 'timid', 'scared'],
            'honest': ['lied', 'deceived', 'dishonest', 'fake'],
            'kind': ['cruel', 'mean', 'heartless', 'rude'],
            'loyal': ['betrayed', 'traitor', 'disloyal'],
            'intelligent': ['foolish', 'stupid', 'ignorant'],
            'calm': ['panicked', 'hysterical', 'frantic'],
          };
          
          const contradictions = opposites[traitLower] || [];
          for (const contradiction of contradictions) {
            if (contentLower.includes(contradiction)) {
              issues.push({
                type: 'character',
                severity: 'minor',
                category: 'traitConsistency',
                message: `Character "${bible.name}" shows "${contradiction}" behavior contrary to trait "${trait}"`,
                expected: trait,
                actual: contradiction,
                suggestion: `Ensure "${trait}" trait is consistently portrayed or show character growth`,
                references: [`character:${charId}:trait:${trait}`],
              });
            }
          }
        }
      }

      // Check weakness consistency - character shouldn't easily overcome weaknesses
      for (const weakness of state.weaknesses) {
        const weaknessLower = weakness.toLowerCase();
        if (contentLower.includes(weaknessLower)) {
          // Check if weakness is magically resolved without explanation
          const resolutionWords = ['overcame', 'conquered', 'defeated', 'mastered', 'no longer'];
          for (const word of resolutionWords) {
            if (contentLower.includes(`${word} ${weaknessLower}`) || contentLower.includes(`${weaknessLower} ${word}`)) {
              issues.push({
                type: 'character',
                severity: 'info',
                category: 'weaknessResolution',
                message: `Character "${bible.name}" appears to overcome weakness "${weakness}" - ensure this is earned`,
                suggestion: 'Show the struggle and process of overcoming the weakness',
                references: [`character:${charId}:weakness:${weakness}`],
              });
            }
          }
        }
      }

      // Check ability consistency - character shouldn't use undeclared abilities
      for (const ability of state.abilities) {
        const abilityLower = ability.toLowerCase();
        if (contentLower.includes(abilityLower)) {
          // Mark as used
        }
      }

      // Track emotional state
      const emotionalKeywords = ['angry', 'happy', 'sad', 'fearful', 'calm', 'anxious', 'excited', 'depressed', 'furious', 'joyful', 'terrified', 'peaceful'];
      for (const emotion of emotionalKeywords) {
        if (contentLower.includes(emotion)) {
          if (state.emotionalState && state.emotionalState !== emotion) {
            issues.push({
              type: 'character',
              severity: 'info',
              category: 'emotionalState',
              message: `Character "${bible.name}" emotional state shifted from "${state.emotionalState}" to "${emotion}"`,
              expected: state.emotionalState,
              actual: emotion,
              suggestion: 'Ensure emotional transition is justified in narrative',
            });
          }
          state.emotionalState = emotion;
        }
      }

      // Track location
      if (context.worldBibles) {
        for (const [worldId, worldBible] of Object.entries(context.worldBibles)) {
          if (worldBible.geography?.landmarks) {
            for (const location of worldBible.geography.landmarks) {
              if (contentLower.includes(location.toLowerCase())) {
                if (state.location && state.location !== location) {
                  issues.push({
                    type: 'character',
                    severity: 'info',
                    category: 'location',
                    message: `Character "${bible.name}" moved from "${state.location}" to "${location}"`,
                    expected: state.location,
                    actual: location,
                    suggestion: 'Ensure travel/transition is shown or explained',
                  });
                }
                state.location = location;
              }
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check plot consistency
   */
  private async checkPlotConsistency(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const contentLower = input.toLowerCase();

    // Check if established plot points are referenced
    for (const [plotPoint, data] of this.plotPoints) {
      const keywords = this.extractKeywords(plotPoint);
      const mentioned = keywords.some(kw => contentLower.includes(kw.toLowerCase()));
      
      if (mentioned) {
        data.established = true;
        if (context.episodeStructure) {
          data.scenes.push(context.episodeStructure.number);
        }
      }

      // Check for premature resolution
      if (data.established && !data.resolved) {
        const resolutionKeywords = ['resolved', 'solved', 'finished', 'completed', 'over', 'done'];
        const resolved = resolutionKeywords.some(kw => contentLower.includes(`${kw} ${plotPoint.toLowerCase()}`));
        if (resolved) {
          data.resolved = true;
          issues.push({
            type: 'plot',
            severity: 'info',
            category: 'resolution',
            message: `Plot point "${plotPoint}" may be resolved`,
            suggestion: 'Verify this resolution aligns with story structure',
            references: [`plot:${plotPoint}`],
          });
        }
      }
    }

    // Check for contradictory plot developments
    const contradictionPatterns = [
      { pattern: /(alive|dead).*\b(dead|alive)/i, message: 'Character life status contradiction' },
      { pattern: /(present|absent).*\b(absent|present)/i, message: 'Character presence contradiction' },
      { pattern: /(know|unknown).*\b(unknown|know)/i, message: 'Knowledge state contradiction' },
    ];

    for (const { pattern, message } of contradictionPatterns) {
      const match = input.match(pattern);
      if (match) {
        issues.push({
          type: 'plot',
          severity: 'major',
          category: 'contradiction',
          message,
          actual: match[0],
          suggestion: 'Review narrative for logical consistency',
        });
      }
    }

    return issues;
  }

  /**
   * Check world consistency
   */
  private async checkWorldConsistency(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const contentLower = input.toLowerCase();

    if (!context.worldBibles) return issues;

    for (const [worldId, worldBible] of Object.entries(context.worldBibles)) {
      // Check geography consistency
      if (worldBible.geography?.landmarks) {
        for (const location of worldBible.geography.landmarks) {
          if (contentLower.includes(location.toLowerCase())) {
            this.worldState.currentLocation = location;
          }
        }
      }

      // Check climate/environment consistency
      if (worldBible.geography?.climate) {
        const climate = worldBible.geography.climate.toLowerCase();
        if (contentLower.includes('snow') && !climate.includes('cold') && !climate.includes('winter') && !climate.includes('arctic')) {
          issues.push({
            type: 'world',
            severity: 'minor',
            category: 'climate',
            message: `Snow mentioned but world climate is "${worldBible.geography.climate}"`,
            expected: worldBible.geography.climate,
            actual: 'snow',
            suggestion: 'Explain unusual weather or adjust description',
          });
        }
      }

      // Check technology level consistency (using geography.terrain as proxy for setting)
      // Since WorldProfile doesn't have explicit technology level, we'll check for anachronisms based on terrain/setting
      const settingKeywords = {
        'fantasy': ['computer', 'phone', 'internet', 'electricity', 'gun', 'car', 'plane', 'smartphone', 'ai', 'robot'],
        'medieval': ['computer', 'phone', 'internet', 'electricity', 'gun', 'car', 'plane', 'smartphone', 'ai', 'robot', 'electric'],
        'modern': ['magic', 'spell', 'dragon', 'mana', 'wizard', 'enchantment'],
        'sci-fi': [],
      };

      // Infer setting from terrain/climate
      let inferredSetting = 'modern';
      if (worldBible.geography?.terrain) {
        const terrain = worldBible.geography.terrain.join(' ').toLowerCase();
        if (terrain.includes('castle') || terrain.includes('kingdom') || terrain.includes('village') || terrain.includes('forest')) {
          inferredSetting = 'fantasy';
        } else if (terrain.includes('space') || terrain.includes('planet') || terrain.includes('station') || terrain.includes('ship')) {
          inferredSetting = 'sci-fi';
        } else if (terrain.includes('city') || terrain.includes('urban') || terrain.includes('metropolis')) {
          inferredSetting = 'modern';
        }
      }

      const forbidden = settingKeywords[inferredSetting as keyof typeof settingKeywords] || [];
      for (const item of forbidden) {
        if (contentLower.includes(item.toLowerCase())) {
          issues.push({
            type: 'world',
            severity: 'major',
            category: 'setting',
            message: `Potentially anachronistic element "${item}" in ${inferredSetting} setting`,
            expected: `Setting: ${inferredSetting}`,
            actual: item,
            suggestion: `Replace with ${inferredSetting}-appropriate equivalent or justify anachronism`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check timeline consistency
   */
  private async checkTimelineConsistency(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    if (!context.worldBibles || !context.episodeStructure) return issues;

    // Track time references
    const timeRefs = [
      'morning', 'afternoon', 'evening', 'night', 'midnight', 'dawn', 'dusk',
      'yesterday', 'today', 'tomorrow', 'last week', 'next week',
      'spring', 'summer', 'autumn', 'fall', 'winter',
    ];

    for (const timeRef of timeRefs) {
      if (input.toLowerCase().includes(timeRef)) {
        if (this.worldState.currentTime && this.worldState.currentTime !== timeRef) {
          issues.push({
            type: 'timeline',
            severity: 'info',
            category: 'timeProgression',
            message: `Time reference shifted from "${this.worldState.currentTime}" to "${timeRef}"`,
            expected: this.worldState.currentTime,
            actual: timeRef,
            suggestion: 'Ensure time progression is clear and consistent',
          });
        }
        this.worldState.currentTime = timeRef;
      }
    }

    // Check episode/scene sequence
    if (context.previousScenes) {
      const currentScene = context.episodeStructure.number;
      for (const prevScene of context.previousScenes) {
        const prevNum = typeof prevScene === 'number' ? prevScene : prevScene.number;
        if (prevNum >= currentScene) {
          issues.push({
            type: 'timeline',
            severity: 'major',
            category: 'sceneOrder',
            message: `Previous scene ${prevNum} >= current scene ${currentScene}`,
            suggestion: 'Check scene numbering and sequence',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check dialogue consistency
   */
  private async checkDialogueConsistency(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    if (!context.characterBibles) return issues;

    // Extract dialogue lines
    const dialogueMatches = input.match(/["']([^"']+)["']/g) || [];
    
    for (const dialogue of dialogueMatches) {
      const cleanDialogue = dialogue.replace(/^["']|["']$/g, '');
      
      // Check which character might be speaking
      for (const [charId, bible] of Object.entries(context.characterBibles)) {
        const charName = bible.name.toLowerCase();
        
        // Simple heuristic: check if character name appears near dialogue
        const charIndex = input.toLowerCase().indexOf(charName);
        const dialogueIndex = input.indexOf(dialogue);
        
        if (charIndex !== -1 && Math.abs(charIndex - dialogueIndex) < 200) {
          // Check voice consistency
          if (bible.voice?.speechPatterns) {
            let matchesPattern = false;
            for (const pattern of bible.voice.speechPatterns) {
              try {
                if (new RegExp(pattern, 'i').test(cleanDialogue)) {
                  matchesPattern = true;
                  break;
                }
              } catch {
                // Invalid regex
              }
            }
            
            if (!matchesPattern && bible.voice.speechPatterns.length > 0) {
              issues.push({
                type: 'dialogue',
                severity: 'minor',
                category: 'voiceConsistency',
                message: `Dialogue may not match ${bible.name}'s speech patterns`,
                suggestion: `Consider incorporating: ${bible.voice.speechPatterns.join(', ')}`,
                references: [`character:${charId}:voice`],
              });
            }
          }

          // Check vocabulary
          if (bible.voice?.vocabulary) {
            const hasVocab = bible.voice.vocabulary.some(v => 
              cleanDialogue.toLowerCase().includes(v.toLowerCase())
            );
            if (!hasVocab && bible.voice.vocabulary.length > 0) {
              issues.push({
                type: 'dialogue',
                severity: 'info',
                category: 'vocabulary',
                message: `Dialogue doesn't use ${bible.name}'s characteristic vocabulary`,
                suggestion: `Consider using: ${bible.voice.vocabulary.slice(0, 3).join(', ')}`,
              });
            }
          }

          // Check catchphrases
          if (bible.voice?.catchphrases) {
            const hasCatchphrase = bible.voice.catchphrases.some(cp => 
              cleanDialogue.toLowerCase().includes(cp.toLowerCase())
            );
            if (!hasCatchphrase && bible.voice.catchphrases.length > 0) {
              issues.push({
                type: 'dialogue',
                severity: 'info',
                category: 'catchphrases',
                message: `Dialogue doesn't include ${bible.name}'s known catchphrases`,
                suggestion: `Consider: ${bible.voice.catchphrases.slice(0, 2).join(', ')}`,
              });
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check action consistency
   */
  private async checkActionConsistency(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    // Check for impossible simultaneous actions
    const simultaneousPatterns = [
      /(ran|sprinted|dashed).*\b(and|while|as)\b.*(stood|sat|lay|slept)/i,
      /(fought|battled).*\b(and|while|as)\b.*(slept|ate|read)/i,
      /(drove|flew|swam).*\b(and|while|as)\b.*(walked|ran)/i,
    ];

    for (const pattern of simultaneousPatterns) {
      const match = input.match(pattern);
      if (match) {
        issues.push({
          type: 'action',
          severity: 'major',
          category: 'simultaneousActions',
          message: `Potentially impossible simultaneous actions: "${match[0]}"`,
          actual: match[0],
          suggestion: 'Separate actions sequentially or clarify how they\'re possible',
        });
      }
    }

    // Check for physics/logic violations
    const physicsViolations = [
      { pattern: /fell.*\b(and|then)\b.*(stood|ran|jumped)/i, message: 'Character falls then immediately performs strenuous action' },
      { pattern: /(unconscious|knocked out).*\b(and|then)\b.*(spoke|fought|ran)/i, message: 'Unconscious character performs conscious action' },
      { pattern: /(blind|cannot see).*\b(and|then)\b.*(saw|watched|observed)/i, message: 'Blind character visually perceives' },
      { pattern: /(bound|tied up|restrained).*\b(and|then)\b.*(ran|fought|escaped)/i, message: 'Restrained character performs free action' },
    ];

    for (const { pattern, message } of physicsViolations) {
      const match = input.match(pattern);
      if (match) {
        issues.push({
          type: 'action',
          severity: 'major',
          category: 'physicsLogic',
          message,
          actual: match[0],
          suggestion: 'Revise for physical/logical consistency',
        });
      }
    }

    return issues;
  }

  /**
   * Check detail continuity (props, clothing, injuries, etc.)
   */
  private async checkDetailContinuity(
    input: string, 
    context: SkillContext
  ): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const contentLower = input.toLowerCase();

    // Track mentioned details
    const detailCategories = {
      clothing: ['wearing', 'dressed in', 'clothed in', 'outfit', 'shirt', 'pants', 'dress', 'coat', 'jacket', 'uniform', 'armor'],
      injuries: ['wound', 'injury', 'cut', 'bruise', 'broken', 'fracture', 'bleeding', 'scar', 'bandage', 'stitches'],
      props: ['holding', 'carrying', 'gripping', 'wielding', 'phone', 'gun', 'knife', 'key', 'book', 'sword', 'weapon', 'device'],
      environment: ['door', 'window', 'wall', 'floor', 'ceiling', 'table', 'chair', 'bed', 'vehicle', 'building'],
    };

    for (const [category, keywords] of Object.entries(detailCategories)) {
      const found = keywords.filter(kw => contentLower.includes(kw));
      if (found.length > 0) {
        // In a full implementation, would track these across scenes
        // For now, just flag if multiple conflicting details in same scene
        if (found.length > 2) {
          issues.push({
            type: 'detail',
            severity: 'info',
            category,
            message: `Multiple ${category} details mentioned: ${found.join(', ')}`,
            suggestion: 'Verify consistency with previous scenes',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .replace(/[.,!?;:"'()]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 10);
  }

  /**
   * Calculate consistency scores
   */
  private calculateScores(
    issues: ConsistencyIssue[], 
    context: SkillContext
  ): ConsistencyAuditResult['scores'] {
    // Base scores
    let characterScore = 1.0;
    let plotScore = 1.0;
    let worldScore = 1.0;
    let timelineScore = 1.0;

    // Deduct for issues
    for (const issue of issues) {
      const deduction = issue.severity === 'critical' ? 0.3 :
                       issue.severity === 'major' ? 0.15 :
                       issue.severity === 'minor' ? 0.05 : 0.01;

      switch (issue.type) {
        case 'character':
        case 'dialogue':
          characterScore -= deduction;
          break;
        case 'plot':
          plotScore -= deduction;
          break;
        case 'world':
          worldScore -= deduction;
          break;
        case 'timeline':
          timelineScore -= deduction;
          break;
        case 'action':
        case 'detail':
          // Affects multiple scores slightly
          characterScore -= deduction * 0.3;
          worldScore -= deduction * 0.3;
          timelineScore -= deduction * 0.3;
          break;
      }
    }

    // Clamp scores
    characterScore = Math.max(0, Math.min(1, characterScore));
    plotScore = Math.max(0, Math.min(1, plotScore));
    worldScore = Math.max(0, Math.min(1, worldScore));
    timelineScore = Math.max(0, Math.min(1, timelineScore));

    const overall = (characterScore + plotScore + worldScore + timelineScore) / 4;

    return {
      characterConsistency: characterScore,
      plotConsistency: plotScore,
      worldConsistency: worldScore,
      timelineConsistency: timelineScore,
      overall,
    };
  }
}

/**
 * Factory function for ConsistencyAuditor
 */
export async function createConsistencyAuditor(config?: Record<string, unknown>): Promise<ConsistencyAuditor> {
  const auditor = new ConsistencyAuditor();
  await auditor.initialize(config);
  return auditor;
}
