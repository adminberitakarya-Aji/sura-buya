/**
 * Suro-Buya Engine v2 - Prop Tracker Skill
 * 
 * Tracks props and items across scenes for continuity.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { PropertySkill } from '../base.js';
import type { SceneGenerationInput, SceneData } from '../../types.js';

/**
 * Prop Tracker configuration
 */
export interface PropTrackerConfig extends Record<string, unknown> {
  /** Track prop locations */
  trackLocations: boolean;
  /** Track prop conditions */
  trackConditions: boolean;
  /** Track prop ownership */
  trackOwnership: boolean;
  /** Alert on untracked props */
  alertUntracked: boolean;
}

/**
 * Prop entry
 */
export interface PropEntry {
  /** Prop ID */
  id: string;
  /** Prop name */
  name: string;
  /** Description */
  description: string;
  /** Current location */
  location?: string;
  /** Current owner */
  owner?: string;
  /** Condition */
  condition: 'pristine' | 'good' | 'worn' | 'damaged' | 'broken' | 'destroyed';
  /** Scene introduced */
  introducedScene: number;
  /** Last seen scene */
  lastSeenScene: number;
  /** Properties */
  properties: Record<string, unknown>;
}

/**
 * Prop analysis result
 */
export interface PropAnalysis {
  /** Props in current scene */
  sceneProps: PropEntry[];
  /** All tracked props */
  allProps: PropEntry[];
  /** Missing props */
  missingProps: PropEntry[];
  /** Issues detected */
  issues: PropIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Prop issue
 */
export interface PropIssue {
  /** Issue type */
  type: 'missing-prop' | 'condition-change' | 'location-mismatch' | 'ownership-change' | 'untracked-prop' | 'prop-appeared';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Prop ID */
  propId: string;
  /** Prop name */
  propName: string;
  /** Scene numbers */
  scenes?: [number, number];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Prop Tracker Skill
 * Tracks props across scenes
 */
export class PropTracker extends PropertySkill<SceneGenerationInput, PropAnalysis> {
  override name = 'PropTracker';
  override version = '1.0.0';
  override description = 'Tracks props and items across scenes for continuity';
  override dependencies: string[] = ['ContinuityGuard'];
  override required = false;
  
  override configSchema = z.object({
    trackLocations: z.boolean().default(true),
    trackConditions: z.boolean().default(true),
    trackOwnership: z.boolean().default(true),
    alertUntracked: z.boolean().default(true),
  });

  override defaultConfig: Record<string, unknown> = {
    trackLocations: true,
    trackConditions: true,
    trackOwnership: true,
    alertUntracked: true,
  };

  protected override config: PropTrackerConfig = {
    trackLocations: true,
    trackConditions: true,
    trackOwnership: true,
    alertUntracked: true,
  };

  // In-memory prop store (in production, would use persistent storage)
  private propStore: Map<string, PropEntry> = new Map();

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<PropAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const issues: PropIssue[] = [];
      const recommendations: string[] = [];

      // Extract props from current scene
      const sceneProps = this.extractPropsFromScene(input, context);
      
      // Update prop store
      this.updatePropStore(sceneProps, input.sceneNumber);

      // Check for issues
      if (cfg.trackLocations) {
        this.checkLocationConsistency(sceneProps, issues);
      }
      if (cfg.trackConditions) {
        this.checkConditionChanges(sceneProps, issues);
      }
      if (cfg.trackOwnership) {
        this.checkOwnershipChanges(sceneProps, issues);
      }
      if (cfg.alertUntracked) {
        this.checkUntrackedProps(sceneProps, issues);
      }

      // Find missing props
      const missingProps = this.findMissingProps(input.sceneNumber);

      // Get all tracked props
      const allProps = Array.from(this.propStore.values());

      // Generate recommendations
      if (issues.some(i => i.type === 'missing-prop')) {
        recommendations.push('Track important props across all scenes');
      }
      if (issues.some(i => i.type === 'condition-change')) {
        recommendations.push('Document prop damage/repair in scene beats');
      }
      if (missingProps.length > 0) {
        recommendations.push(`${missingProps.length} props not seen recently - verify continuity`);
      }

      const analysis: PropAnalysis = {
        sceneProps,
        allProps,
        missingProps,
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
   * Extract props from scene beats
   */
  private extractPropsFromScene(input: SceneGenerationInput, context: SkillContext): PropEntry[] {
    const props: PropEntry[] = [];
    const propKeywords = ['holding', 'carrying', 'using', 'wielding', 'with', 'has', 'wearing', 'found', 'picked up', 'dropped', 'gave', 'received'];
    
    for (const beat of input.keyBeats) {
      const beatLower = beat.toLowerCase();
      const words = beatLower.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word && propKeywords.includes(word) && i + 1 < words.length) {
          // Extract prop name (next few words until punctuation or keyword)
          let propName = '';
          for (let j = i + 1; j < words.length && j < i + 4; j++) {
            const nextWord = words[j];
            if (!nextWord) continue;
            if (['and', 'the', 'a', 'an', 'his', 'her', 'their', 'my', 'your'].includes(nextWord)) continue;
            propName += nextWord + ' ';
            if (nextWord.match(/[.!?,;]/)) break;
          }
          propName = propName.trim().replace(/[.!?,;]+$/, '');
          
          if (propName.length > 1) {
            const existingProp = this.findMatchingProp(propName);
            const propEntry: PropEntry = existingProp || {
              id: this.generatePropId(propName),
              name: propName,
              description: `Prop from scene ${input.sceneNumber}: ${beat}`,
              condition: 'good',
              introducedScene: input.sceneNumber,
              lastSeenScene: input.sceneNumber,
              properties: {},
            };
            
            // Update context
            propEntry.location = input.location;
            propEntry.lastSeenScene = input.sceneNumber;
            
            // Check for ownership
            for (const charId of input.characters) {
              const char = context.characterBibles[charId];
              if (char?.name && beatLower.includes(char.name.toLowerCase())) {
                propEntry.owner = charId;
                break;
              }
            }
            
            // Check condition keywords
            if (beatLower.includes('broken') || beatLower.includes('damaged')) propEntry.condition = 'damaged';
            else if (beatLower.includes('worn') || beatLower.includes('old')) propEntry.condition = 'worn';
            else if (beatLower.includes('pristine') || beatLower.includes('new')) propEntry.condition = 'pristine';
            
            props.push(propEntry);
          }
        }
      }
    }

    return props;
  }

  /**
   * Find matching prop in store
   */
  private findMatchingProp(name: string): PropEntry | undefined {
    const nameLower = name.toLowerCase();
    for (const prop of this.propStore.values()) {
      if (prop.name.toLowerCase().includes(nameLower) || nameLower.includes(prop.name.toLowerCase())) {
        return prop;
      }
    }
    return undefined;
  }

  /**
   * Generate prop ID
   */
  private generatePropId(name: string): string {
    return `prop_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  /**
   * Update prop store with scene props
   */
  private updatePropStore(sceneProps: PropEntry[], sceneNumber: number): void {
    for (const prop of sceneProps) {
      if (this.propStore.has(prop.id)) {
        const existing = this.propStore.get(prop.id)!;
        // Merge updates
        existing.location = prop.location || existing.location;
        existing.owner = prop.owner || existing.owner;
        existing.condition = prop.condition || existing.condition;
        existing.lastSeenScene = sceneNumber;
        existing.description = prop.description || existing.description;
      } else {
        this.propStore.set(prop.id, prop);
      }
    }
  }

  /**
   * Check location consistency
   */
  private checkLocationConsistency(sceneProps: PropEntry[], issues: PropIssue[]): void {
    for (const prop of sceneProps) {
      const stored = this.propStore.get(prop.id);
      if (stored && stored.location && prop.location && stored.location !== prop.location) {
        // Check if character moved it
        if (stored.owner && prop.owner && stored.owner === prop.owner) {
          // Owner moved - OK
        } else {
          issues.push({
            type: 'location-mismatch',
            severity: 'medium',
            propId: prop.id,
            propName: prop.name,
            scenes: [stored.lastSeenScene, prop.lastSeenScene!],
            description: `Prop "${prop.name}" moved from ${stored.location} to ${prop.location} without clear owner`,
            suggestion: 'Show character moving prop or establish it was moved',
          });
        }
      }
    }
  }

  /**
   * Check condition changes
   */
  private checkConditionChanges(sceneProps: PropEntry[], issues: PropIssue[]): void {
    const conditionOrder = ['pristine', 'good', 'worn', 'damaged', 'broken', 'destroyed'];
    
    for (const prop of sceneProps) {
      const stored = this.propStore.get(prop.id);
      if (stored && stored.condition !== prop.condition) {
        const prevIdx = conditionOrder.indexOf(stored.condition);
        const currIdx = conditionOrder.indexOf(prop.condition);
        
        if (currIdx < prevIdx) {
          // Condition improved - needs explanation
          issues.push({
            type: 'condition-change',
            severity: 'medium',
            propId: prop.id,
            propName: prop.name,
            scenes: [stored.lastSeenScene, prop.lastSeenScene!],
            description: `Prop "${prop.name}" condition improved from ${stored.condition} to ${prop.condition}`,
            suggestion: 'Show repair/maintenance or justify improvement',
          });
        } else if (currIdx > prevIdx + 1) {
          // Condition degraded significantly
          issues.push({
            type: 'condition-change',
            severity: 'high',
            propId: prop.id,
            propName: prop.name,
            scenes: [stored.lastSeenScene, prop.lastSeenScene!],
            description: `Prop "${prop.name}" severely degraded from ${stored.condition} to ${prop.condition}`,
            suggestion: 'Show damage occurring or establish cause',
          });
        }
      }
    }
  }

  /**
   * Check ownership changes
   */
  private checkOwnershipChanges(sceneProps: PropEntry[], issues: PropIssue[]): void {
    for (const prop of sceneProps) {
      const stored = this.propStore.get(prop.id);
      if (stored && stored.owner && prop.owner && stored.owner !== prop.owner) {
        issues.push({
          type: 'ownership-change',
          severity: 'low',
          propId: prop.id,
          propName: prop.name,
          scenes: [stored.lastSeenScene, prop.lastSeenScene!],
          description: `Prop "${prop.name}" ownership changed from ${stored.owner} to ${prop.owner}`,
          suggestion: 'Show transfer/exchange in beats',
        });
      }
    }
  }

  /**
   * Check for untracked props
   */
  private checkUntrackedProps(sceneProps: PropEntry[], issues: PropIssue[]): void {
    for (const prop of sceneProps) {
      if (!this.propStore.has(prop.id) && prop.introducedScene === prop.lastSeenScene) {
        // Brand new prop - not necessarily an issue, but track it
      }
    }
  }

  /**
   * Find props not seen recently
   */
  private findMissingProps(currentScene: number): PropEntry[] {
    const missing: PropEntry[] = [];
    const threshold = 5; // Scenes before considered "missing"
    
    for (const prop of this.propStore.values()) {
      if (currentScene - prop.lastSeenScene > threshold) {
        missing.push(prop);
      }
    }
    
    return missing;
  }

  /**
   * Get all tracked props
   */
  getTrackedProps(): PropEntry[] {
    return Array.from(this.propStore.values());
  }

  /**
   * Clear prop store (for testing)
   */
  clearStore(): void {
    this.propStore.clear();
  }
}

/**
 * Factory for creating PropTracker
 */
export async function createPropTracker(
  config?: Partial<PropTrackerConfig>
): Promise<PropTracker> {
  const skill = new PropTracker();
  await skill.initialize(config);
  return skill;
}