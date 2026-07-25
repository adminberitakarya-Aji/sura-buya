/**
 * Suro-Buya Engine v2 - Continuity Guard Skill
 * 
 * Ensures scene-to-scene continuity across episodes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { EnvironmentSkill } from '../base.js';
import type { SceneGenerationInput, SceneData } from '../../types.js';

/**
 * Continuity Guard configuration
 */
export interface ContinuityGuardConfig extends Record<string, unknown> {
  /** Check character state continuity */
  checkCharacterState: boolean;
  /** Check world state continuity */
  checkWorldState: boolean;
  /** Check prop/item continuity */
  checkProps: boolean;
  /** Check temporal continuity */
  checkTemporal: boolean;
  /** Maximum allowed time gap (hours) */
  maxTimeGap: number;
}

/**
 * Continuity issue
 */
export interface ContinuityIssue {
  /** Issue type */
  type: 'character-state' | 'world-state' | 'prop' | 'temporal' | 'location' | 'knowledge';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Element involved */
  element: string;
  /** Previous value */
  previousValue?: string;
  /** Current value */
  currentValue?: string;
  /** Scene numbers */
  scenes: [number, number];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Continuity analysis result
 */
export interface ContinuityAnalysis {
  /** Current scene number */
  currentScene: number;
  /** Previous scene number */
  previousScene: number;
  /** Issues detected */
  issues: ContinuityIssue[];
  /** Consistency score */
  consistencyScore: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Continuity Guard Skill
 * Ensures scene-to-scene continuity
 */
export class ContinuityGuard extends EnvironmentSkill<SceneGenerationInput, ContinuityAnalysis> {
  override name = 'ContinuityGuard';
  override version = '1.0.0';
  override description = 'Ensures scene-to-scene continuity across episodes';
  override dependencies: string[] = ['LoreKeeper', 'GeographyChecker', 'CultureValidator'];
  override required = false;
  
  override configSchema = z.object({
    checkCharacterState: z.boolean().default(true),
    checkWorldState: z.boolean().default(true),
    checkProps: z.boolean().default(true),
    checkTemporal: z.boolean().default(true),
    maxTimeGap: z.number().default(24),
  });

  override defaultConfig: Record<string, unknown> = {
    checkCharacterState: true,
    checkWorldState: true,
    checkProps: true,
    checkTemporal: true,
    maxTimeGap: 24,
  };

  protected override config: ContinuityGuardConfig = {
    checkCharacterState: true,
    checkWorldState: true,
    checkProps: true,
    checkTemporal: true,
    maxTimeGap: 24,
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<ContinuityAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const issues: ContinuityIssue[] = [];
      const recommendations: string[] = [];

      const currentSceneNum = input.sceneNumber;
      const previousSceneNum = currentSceneNum - 1;

      // Get previous scene data
      const previousScene = this.getPreviousScene(context, previousSceneNum);
      
      if (previousScene) {
        // Check character state continuity
        if (cfg.checkCharacterState) {
          input.characters.forEach(charId => {
            this.checkCharacterStateContinuity(charId, input, previousScene, context, issues);
          });
        }

        // Check world state continuity
        if (cfg.checkWorldState) {
          this.checkWorldStateContinuity(input, previousScene, context, issues);
        }

        // Check prop continuity
        if (cfg.checkProps) {
          this.checkPropContinuity(input, previousScene, context, issues);
        }

        // Check temporal continuity
        if (cfg.checkTemporal) {
          this.checkTemporalContinuity(input, previousScene, cfg.maxTimeGap, issues);
        }

        // Check location continuity
        this.checkLocationContinuity(input, previousScene, context, issues);

        // Check knowledge continuity
        this.checkKnowledgeContinuity(input, previousScene, context, issues);
      }

      // Calculate consistency score
      const consistencyScore = this.calculateConsistencyScore(issues);

      // Generate recommendations
      if (issues.some(i => i.type === 'character-state')) {
        recommendations.push('Verify character emotional/physical states match previous scene');
      }
      if (issues.some(i => i.type === 'prop')) {
        recommendations.push('Track prop locations and conditions across scenes');
      }
      if (issues.some(i => i.type === 'temporal')) {
        recommendations.push('Ensure time progression is logical and consistent');
      }
      if (issues.length === 0 && previousScene) {
        recommendations.push('Continuity clean - consider adding subtle callbacks to previous scene');
      }

      const analysis: ContinuityAnalysis = {
        currentScene: currentSceneNum,
        previousScene: previousSceneNum,
        issues,
        consistencyScore,
        recommendations: Array.from(new Set(recommendations)),
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
   * Get previous scene data from context
   */
  private getPreviousScene(context: SkillContext, sceneNum: number): SceneData | undefined {
    if (!context.previousScenes || context.previousScenes.length === 0) return undefined;
    
    const prevSceneId = context.previousScenes[context.previousScenes.length - 1];
    // In real implementation, would fetch from scene store
    // For now, return undefined to indicate no previous scene data
    return undefined;
  }

  /**
   * Check character state continuity
   */
  private checkCharacterStateContinuity(
    charId: string,
    input: SceneGenerationInput,
    previousScene: SceneData,
    context: SkillContext,
    issues: ContinuityIssue[]
  ): void {
    // Cast to unknown to access extended properties
    const prevScene = previousScene as unknown as Record<string, unknown>;
    const prevCharState = (context['characterStates']?.[charId] || {}) as Record<string, unknown>;
    // Current character state would come from context or be passed in scene input
    // For now, we use an empty object as the current state is not in SceneGenerationInput
    const currCharState = {} as Record<string, unknown>;

    // Check if character was in previous scene
    const prevCharacters = prevScene['characters'] as string[] | undefined;
    const wasInPrevious = prevCharacters?.includes(charId);
    if (!wasInPrevious) return;

    const character = context.characterBibles[charId];
    if (!character) return;

    // Check emotional state
    const prevEmotional = prevCharState['emotionalState'] as string | undefined;
    const currEmotional = currCharState['emotionalState'] as string | undefined;

    if (prevEmotional && currEmotional) {
      // Check for impossible emotional jumps
      if (this.isImpossibleEmotionalJump(prevEmotional, currEmotional)) {
        issues.push({
          type: 'character-state',
          severity: 'medium',
          element: `emotionalState:${charId}`,
          previousValue: prevEmotional,
          currentValue: currEmotional,
          scenes: [prevScene['sceneNumber'] as number, input.sceneNumber],
          description: `Impossible emotional jump from "${prevEmotional}" to "${currEmotional}"`,
          suggestion: 'Add transitional beat or justify sudden change',
        });
      }

      // Check physical state
      const prevPhysical = prevCharState['physicalState'] as string | undefined;
      const currPhysical = currCharState['physicalState'] as string | undefined;

      if (prevPhysical && currPhysical) {
        if (this.isImpossiblePhysicalJump(prevPhysical, currPhysical)) {
          issues.push({
            type: 'character-state',
            severity: 'high',
            element: `physicalState:${charId}`,
            previousValue: prevPhysical,
            currentValue: currPhysical,
            scenes: [prevScene['sceneNumber'] as number, input.sceneNumber],
            description: `Impossible physical state change from "${prevPhysical}" to "${currPhysical}"`,
            suggestion: 'Add recovery time or explain miraculous recovery',
          });
        }
      }

      // Check inventory
      const prevInventory = prevCharState['inventory'] as string[] | undefined;
      const currInventory = currCharState['inventory'] as string[] | undefined;

      if (prevInventory && currInventory) {
        const lostItems = prevInventory.filter(i => !currInventory?.includes(i));
        const gainedItems = currInventory.filter(i => !prevInventory?.includes(i));
        
        if (lostItems.length > 0) {
          issues.push({
            type: 'prop',
            severity: 'medium',
            element: `inventory:${charId}`,
            previousValue: prevInventory.join(', '),
            currentValue: currInventory.join(', '),
            scenes: [prevScene['sceneNumber'] as number, input.sceneNumber],
            description: `Character lost items: ${lostItems.join(', ')}`,
            suggestion: 'Explain where items went or track them',
          });
        }
      }
    }
  }

  /**
   * Check if emotional jump is impossible
   */
  private isImpossibleEmotionalJump(prev: string, curr: string): boolean {
    const extremePairs: [string, string][] = [
      ['ecstatic', 'devastated'],
      ['furious', 'serene'],
      ['terrified', 'fearless'],
      ['despairing', 'hopeful'],
      ['grieving', 'joyful'],
    ];

    return extremePairs.some(([a, b]) => 
      (prev.includes(a) && curr.includes(b)) || (prev.includes(b) && curr.includes(a))
    );
  }

  /**
   * Check if physical jump is impossible
   */
  private isImpossiblePhysicalJump(prev: string, curr: string): boolean {
    const impossibleTransitions: [string, string][] = [
      ['injured', 'healthy'],
      ['exhausted', 'energetic'],
      ['unconscious', 'conscious'],
      ['bound', 'free'],
      ['captured', 'free'],
    ];

    return impossibleTransitions.some(([a, b]) => 
      prev.includes(a) && curr.includes(b)
    );
  }

  /**
   * Check world state continuity
   */
  private checkWorldStateContinuity(
    input: SceneGenerationInput,
    previousScene: SceneData,
    context: SkillContext,
    issues: ContinuityIssue[]
  ): void {
    const currWorld = context.worldState;
    const prevWorld = previousScene as unknown as { worldState?: Record<string, unknown> };
    const prevWorldState = prevWorld.worldState || {};

    if (!currWorld || Object.keys(prevWorldState).length === 0) return;

    // Check major world changes
    for (const [key, prevValue] of Object.entries(prevWorldState)) {
      const currValue = currWorld[key];
      if (currValue !== undefined && prevValue !== currValue) {
        // Check if change is plausible
        if (this.isImplausibleWorldChange(key, prevValue, currValue)) {
          issues.push({
            type: 'world-state',
            severity: 'high',
            element: key,
            previousValue: String(prevValue),
            currentValue: String(currValue),
            scenes: [input.sceneNumber - 1, input.sceneNumber],
            description: `Implausible world state change: ${key} from "${prevValue}" to "${currValue}"`,
            suggestion: 'Add scene showing the change or justify it',
          });
        }
      }
    }
  }

  /**
   * Check if world change is implausible
   */
  private isImplausibleWorldChange(key: string, prev: unknown, curr: unknown): boolean {
    const implausibleKeys = ['ruler', 'government', 'law', 'geography', 'climate'];
    return implausibleKeys.some(k => key.toLowerCase().includes(k));
  }

  /**
   * Check prop continuity
   */
  private checkPropContinuity(
    input: SceneGenerationInput,
    previousScene: SceneData,
    context: SkillContext,
    issues: ContinuityIssue[]
  ): void {
    const prevScene = previousScene as unknown as { keyBeats?: string[] };
    // Check props in beats
    const prevProps = this.extractPropsFromBeats(prevScene.keyBeats || []);
    const currProps = this.extractPropsFromBeats(input.keyBeats);

    // Check for props that disappeared
    for (const prop of prevProps) {
      if (!currProps.includes(prop) && !this.isConsumable(prop)) {
        issues.push({
          type: 'prop',
          severity: 'low',
          element: prop,
          scenes: [input.sceneNumber - 1, input.sceneNumber],
          description: `Prop "${prop}" present in previous scene but not in current`,
          suggestion: 'Track prop location or explain absence',
        });
      }
    }
  }

  /**
   * Extract props from beats
   */
  private extractPropsFromBeats(beats: string[]): string[] {
    const props: string[] = [];
    const propKeywords = ['holding', 'carrying', 'using', 'wielding', 'with', 'has', 'wearing'];
    
    for (const beat of beats) {
      const words = beat.toLowerCase().split(' ');
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const nextWord = words[i + 1];
        if (word && nextWord && propKeywords.includes(word)) {
          props.push(nextWord);
        }
      }
    }
    return Array.from(new Set(props));
  }

  /**
   * Check if prop is consumable
   */
  private isConsumable(prop: string): boolean {
    const consumables = ['food', 'drink', 'water', 'potion', 'ammo', 'arrow', 'bullet', 'fuel'];
    return consumables.some(c => prop.toLowerCase().includes(c));
  }

  /**
   * Check temporal continuity
   */
  private checkTemporalContinuity(
    input: SceneGenerationInput,
    previousScene: SceneData,
    maxGap: number,
    issues: ContinuityIssue[]
  ): void {
    const prevScene = previousScene as unknown as { timeOfDay?: string };
    const prevTime = prevScene.timeOfDay;
    const currTime = input.timeOfDay;

    if (!prevTime || !currTime) return;

    const prevHour = this.timeOfDayToHour(prevTime);
    const currHour = this.timeOfDayToHour(currTime);

    let gap = currHour - prevHour;
    if (gap < 0) gap += 24; // Next day

    if (gap > maxGap) {
      issues.push({
        type: 'temporal',
        severity: 'medium',
        element: 'timeOfDay',
        previousValue: prevTime,
        currentValue: currTime,
        scenes: [input.sceneNumber - 1, input.sceneNumber],
        description: `Time gap of ${gap} hours exceeds maximum ${maxGap}`,
        suggestion: 'Add transition scenes or justify time jump',
      });
    }

    // Check for impossible time flow
    if (prevTime === 'night' && currTime === 'morning' && gap > 12) {
      issues.push({
        type: 'temporal',
        severity: 'low',
        element: 'timeOfDay',
        previousValue: prevTime,
        currentValue: currTime,
        scenes: [input.sceneNumber - 1, input.sceneNumber],
        description: 'Unusually long night-to-morning transition',
        suggestion: 'Verify time progression or add night scenes',
      });
    }
  }

  /**
   * Convert time of day to hour
   */
  private timeOfDayToHour(time: string): number {
    const times: Record<string, number> = {
      midnight: 0,
      dawn: 6,
      morning: 9,
      noon: 12,
      afternoon: 15,
      evening: 18,
      dusk: 20,
      night: 22,
    };
    return times[time.toLowerCase()] || 12;
  }

  /**
   * Check location continuity
   */
  private checkLocationContinuity(
    input: SceneGenerationInput,
    previousScene: SceneData,
    context: SkillContext,
    issues: ContinuityIssue[]
  ): void {
    const prevScene = previousScene as unknown as { location?: string };
    const prevLocation = prevScene.location;
    const currLocation = input.location;

    if (!prevLocation || !currLocation) return;
    if (prevLocation === currLocation) return;

    // Check if travel is possible
    const travelTime = this.estimateTravelTime(prevLocation, currLocation, context);
    if (travelTime > 120) { // More than 2 hours
      issues.push({
        type: 'location',
        severity: 'medium',
        element: 'location',
        previousValue: prevLocation,
        currentValue: currLocation,
        scenes: [input.sceneNumber - 1, input.sceneNumber],
        description: `Scene jumps from "${prevLocation}" to "${currLocation}" (est. ${travelTime} min travel)`,
        suggestion: 'Add travel scene or establish fast travel method',
      });
    }
  }

  /**
   * Estimate travel time between locations
   */
  private estimateTravelTime(from: string, to: string, context: SkillContext): number {
    // Simplified - in reality would use world geography
    const baseTime = 30; // minutes
    
    // Check if locations are in same world
    let sameWorld = false;
    for (const world of Object.values(context.worldBibles)) {
      const hasFrom = world.geography?.landmarks?.includes(from);
      const hasTo = world.geography?.landmarks?.includes(to);
      if (hasFrom && hasTo) sameWorld = true;
    }
    
    return sameWorld ? baseTime : baseTime * 5; // Different worlds = longer
  }

  /**
   * Check knowledge continuity
   */
  private checkKnowledgeContinuity(
    input: SceneGenerationInput,
    previousScene: SceneData,
    context: SkillContext,
    issues: ContinuityIssue[]
  ): void {
    const currInput = input as unknown as { characterStates?: Record<string, { knowledge?: string[] }> };
    // Check if characters know things they shouldn't
    // This would integrate with character state tracking
    for (const charId of input.characters) {
      const prevCharState = (context.characterStates?.[charId] || {}) as { knowledge?: string[] };
      const currCharState = (currInput.characterStates?.[charId] || {}) as { knowledge?: string[] };
      const prevKnowledge = prevCharState.knowledge || [];
      const currKnowledge = currCharState.knowledge || [];
      
      // Check for knowledge gained without source
      for (const knowledge of currKnowledge) {
        if (!prevKnowledge.includes(knowledge) && !this.isCommonKnowledge(knowledge, input)) {
          issues.push({
            type: 'knowledge',
            severity: 'low',
            element: `knowledge:${charId}`,
            currentValue: knowledge,
            scenes: [input.sceneNumber - 1, input.sceneNumber],
            description: `Character knows "${knowledge}" without established source`,
            suggestion: 'Show how character learned this or establish as common knowledge',
          });
        }
      }
    }
  }

  /**
   * Check if knowledge is common
   */
  private isCommonKnowledge(knowledge: string, input: SceneGenerationInput): boolean {
    const commonTopics = ['weather', 'time', 'location name', 'public event', 'rumor'];
    return commonTopics.some(t => knowledge.toLowerCase().includes(t));
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(issues: ContinuityIssue[]): number {
    let score = 1.0;
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'high': score -= 0.25; break;
        case 'medium': score -= 0.15; break;
        case 'low': score -= 0.05; break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Factory for creating ContinuityGuard
 */
export async function createContinuityGuard(
  config?: Partial<ContinuityGuardConfig>
): Promise<ContinuityGuard> {
  const skill = new ContinuityGuard();
  await skill.initialize(config);
  return skill;
}