/**
 * Suro-Buya Engine v2 - Visual Reference Matcher Skill
 * 
 * Matches visual references and descriptions across scenes for consistency.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { PropertySkill } from '../base.js';
import type { SceneGenerationInput, SceneData, WorldProfile, CharacterProfile } from '../../types.js';

/**
 * Visual Reference Matcher configuration
 */
export interface VisualReferenceMatcherConfig extends Record<string, unknown> {
  /** Check character visual consistency */
  checkCharacters: boolean;
  /** Check location visual consistency */
  checkLocations: boolean;
  /** Check prop visual consistency */
  checkProps: boolean;
  /** Check lighting/mood consistency */
  checkLighting: boolean;
  /** Fuzzy matching threshold */
  fuzzyThreshold: number;
}

/**
 * Visual reference
 */
export interface VisualReference {
  /** Reference ID */
  id: string;
  /** Element type */
  type: 'character' | 'location' | 'prop' | 'lighting' | 'effect';
  /** Element name */
  name: string;
  /** Visual description */
  description: string;
  /** Key visual features */
  features: string[];
  /** Scene introduced */
  introducedScene: number;
  /** Last seen scene */
  lastSeenScene: number;
  /** Reference images (URLs or paths) */
  references: string[];
}

/**
 * Visual analysis result
 */
export interface VisualAnalysis {
  /** Visual references in current scene */
  sceneReferences: VisualReference[];
  /** All tracked references */
  allReferences: VisualReference[];
  /** Mismatches detected */
  mismatches: VisualMismatch[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Visual mismatch
 */
export interface VisualMismatch {
  /** Mismatch type */
  type: 'feature-mismatch' | 'color-mismatch' | 'lighting-mismatch' | 'age-mismatch' | 'damage-mismatch' | 'outfit-mismatch';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Reference ID */
  referenceId: string;
  /** Element name */
  elementName: string;
  /** Expected feature */
  expected: string;
  /** Actual feature */
  actual: string;
  /** Scene numbers */
  scenes: [number, number];
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Visual Reference Matcher Skill
 * Matches visual references across scenes
 */
export class VisualReferenceMatcher extends PropertySkill<SceneGenerationInput, VisualAnalysis> {
  override name = 'VisualReferenceMatcher';
  override version = '1.0.0';
  override description = 'Matches visual references and descriptions across scenes for consistency';
  override dependencies: string[] = ['PropTracker', 'ItemContinuity', 'ContinuityGuard'];
  override required = false;
  
  override configSchema = z.object({
    checkCharacters: z.boolean().default(true),
    checkLocations: z.boolean().default(true),
    checkProps: z.boolean().default(true),
    checkLighting: z.boolean().default(true),
    fuzzyThreshold: z.number().min(0).max(1).default(0.7),
  });

  override defaultConfig: Record<string, unknown> = {
    checkCharacters: true,
    checkLocations: true,
    checkProps: true,
    checkLighting: true,
    fuzzyThreshold: 0.7,
  };

  protected override config: VisualReferenceMatcherConfig = {
    checkCharacters: true,
    checkLocations: true,
    checkProps: true,
    checkLighting: true,
    fuzzyThreshold: 0.7,
  };

  // Visual reference store
  private referenceStore: Map<string, VisualReference> = new Map();

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<VisualAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const mismatches: VisualMismatch[] = [];
      const recommendations: string[] = [];

      // Extract visual references from current scene
      const sceneReferences = this.extractVisualReferences(input, context);
      
      // Update reference store
      this.updateReferenceStore(sceneReferences, input.sceneNumber);

      // Check for mismatches
      if (cfg.checkCharacters) {
        this.checkCharacterVisuals(sceneReferences, input, context, mismatches);
      }
      if (cfg.checkLocations) {
        this.checkLocationVisuals(sceneReferences, input, context, mismatches);
      }
      if (cfg.checkProps) {
        this.checkPropVisuals(sceneReferences, mismatches);
      }
      if (cfg.checkLighting) {
        this.checkLightingConsistency(sceneReferences, input, mismatches);
      }

      // Get all tracked references
      const allReferences = Array.from(this.referenceStore.values());

      // Generate recommendations
      if (mismatches.some(m => m.type === 'feature-mismatch')) {
        recommendations.push('Ensure character/location features remain consistent');
      }
      if (mismatches.some(m => m.type === 'outfit-mismatch')) {
        recommendations.push('Track character outfit changes explicitly');
      }
      if (mismatches.some(m => m.type === 'lighting-mismatch')) {
        recommendations.push('Maintain consistent lighting for time of day');
      }

      const analysis: VisualAnalysis = {
        sceneReferences,
        allReferences,
        mismatches,
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
   * Extract visual references from scene
   */
  private extractVisualReferences(input: SceneGenerationInput, context: SkillContext): VisualReference[] {
    const references: VisualReference[] = [];

    // Character visuals
    for (const charId of input.characters) {
      const character = context.characterBibles[charId];
      if (character) {
        const ref = this.createCharacterReference(character, charId, input.sceneNumber);
        references.push(ref);
      }
    }

    // Location visuals
    for (const world of Object.values(context.worldBibles)) {
      if (world.geography?.landmarks?.includes(input.location) || world.name === input.location) {
        const ref = this.createLocationReference(world, input.location, input.sceneNumber);
        references.push(ref);
      }
    }

    // Prop visuals (from key beats)
    const propRefs = this.extractPropVisuals(input);
    references.push(...propRefs);

    // Lighting/mood
    const lightingRef = this.createLightingReference(input);
    references.push(lightingRef);

    return references;
  }

  /**
   * Create character visual reference
   */
  private createCharacterReference(character: CharacterProfile, charId: string, sceneNum: number): VisualReference {
    const features: string[] = [];

    // Use traits and voice from character profile
    if (character.traits) {
      features.push(...character.traits.map(t => `trait: ${t}`));
    }
    if (character.voice) {
      if (character.voice.tone) features.push(`tone: ${character.voice.tone}`);
      if (character.voice.vocabulary?.length) features.push(`vocabulary: ${character.voice.vocabulary.join(', ')}`);
      if (character.voice.speechPatterns?.length) features.push(`speech: ${character.voice.speechPatterns.join(', ')}`);
      if (character.voice.catchphrases?.length) features.push(`catchphrases: ${character.voice.catchphrases.join(', ')}`);
    }
    if (character.visualReference) {
      features.push(`visual: ${character.visualReference}`);
    }
    if (character.abilities?.length) {
      features.push(`abilities: ${character.abilities.join(', ')}`);
    }
    if (character.weaknesses?.length) {
      features.push(`weaknesses: ${character.weaknesses.join(', ')}`);
    }

    const description = [
      `${character.name} (${character.archetype})`,
      character.description,
      character.traits?.join(', '),
      character.visualReference,
    ].filter(Boolean).join(', ');

    return {
      id: `char_visual_${charId}`,
      type: 'character',
      name: character.name,
      description,
      features,
      introducedScene: sceneNum,
      lastSeenScene: sceneNum,
      references: character.visualReference ? [character.visualReference] : [],
    };
  }

  /**
   * Create location visual reference
   */
  private createLocationReference(world: WorldProfile, location: string, sceneNum: number): VisualReference {
    const geo = world.geography;
    const features: string[] = [];

    if (geo?.terrain) features.push(...geo.terrain);
    if (geo?.climate) features.push(`climate: ${geo.climate}`);
    if (geo?.landmarks) features.push(`landmarks: ${geo.landmarks.join(', ')}`);

    const description = `${location} in ${world.name}: ${geo?.terrain?.join(', ') || 'varied terrain'}, ${geo?.climate || 'moderate climate'}`;

    return {
      id: `loc_visual_${location.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'location',
      name: location,
      description,
      features,
      introducedScene: sceneNum,
      lastSeenScene: sceneNum,
      references: world.visualReference ? [world.visualReference] : [],
    };
  }

  /**
   * Extract prop visuals from beats
   */
  private extractPropVisuals(input: SceneGenerationInput): VisualReference[] {
    const refs: VisualReference[] = [];
    const visualKeywords = ['looks like', 'appears', 'resembles', 'shaped like', 'colored', 'painted', 'decorated'];

    for (const beat of input.keyBeats) {
      const beatLower = beat.toLowerCase();
      
      for (const keyword of visualKeywords) {
        const idx = beatLower.indexOf(keyword);
        if (idx !== -1) {
          // Extract visual description
          const afterKeyword = beat.substring(idx + keyword.length).trim();
          const words = afterKeyword.split(' ');
          let desc = '';
          for (let i = 0; i < Math.min(words.length, 8); i++) {
            desc += words[i] + ' ';
          }
          desc = desc.trim();

          if (desc.length > 3) {
            refs.push({
              id: `prop_visual_${Date.now()}_${refs.length}`,
              type: 'prop',
              name: `Prop from beat ${input.keyBeats.indexOf(beat)}`,
              description: desc,
              features: [desc],
              introducedScene: input.sceneNumber,
              lastSeenScene: input.sceneNumber,
              references: [],
            });
          }
        }
      }
    }

    return refs;
  }

  /**
   * Create lighting reference
   */
  private createLightingReference(input: SceneGenerationInput): VisualReference {
    const timeOfDay = input.timeOfDay;
    let lighting = 'neutral';
    let mood = 'neutral';

    switch (timeOfDay.toLowerCase()) {
      case 'dawn': lighting = 'soft golden morning light'; mood = 'hopeful'; break;
      case 'morning': lighting = 'bright morning light'; mood = 'energetic'; break;
      case 'noon': lighting = 'harsh overhead light'; mood = 'exposed'; break;
      case 'afternoon': lighting = 'warm afternoon light'; mood = 'active'; break;
      case 'evening': lighting = 'golden hour light'; mood = 'reflective'; break;
      case 'dusk': lighting = 'fading twilight'; mood = 'melancholic'; break;
      case 'night': lighting = 'dark, moonlight/starlight'; mood = 'mysterious'; break;
      case 'midnight': lighting = 'deep darkness'; mood = 'ominous'; break;
    }

    return {
      id: `lighting_${input.sceneNumber}`,
      type: 'lighting',
      name: `Scene ${input.sceneNumber} lighting`,
      description: `${lighting}, ${mood} mood`,
      features: [lighting, `mood: ${mood}`, `time: ${timeOfDay}`],
      introducedScene: input.sceneNumber,
      lastSeenScene: input.sceneNumber,
      references: [],
    };
  }

  /**
   * Update reference store
   */
  private updateReferenceStore(refs: VisualReference[], sceneNum: number): void {
    for (const ref of refs) {
      if (this.referenceStore.has(ref.id)) {
        const existing = this.referenceStore.get(ref.id)!;
        existing.lastSeenScene = sceneNum;
        // Merge features
        existing.features = [...new Set([...existing.features, ...ref.features])];
      } else {
        this.referenceStore.set(ref.id, ref);
      }
    }
  }

  /**
   * Check character visual consistency
   */
  private checkCharacterVisuals(
    sceneRefs: VisualReference[],
    input: SceneGenerationInput,
    context: SkillContext,
    mismatches: VisualMismatch[]
  ): void {
    const charRefs = sceneRefs.filter(r => r.type === 'character');
    
    for (const ref of charRefs) {
      const stored = this.referenceStore.get(ref.id);
      if (!stored) continue;

      // Check for feature mismatches
      for (const feature of ref.features) {
        const storedHasFeature = stored.features.some(f => this.fuzzyMatch(f, feature, this.config.fuzzyThreshold));
        if (!storedHasFeature && feature.includes('outfit')) {
          mismatches.push({
            type: 'outfit-mismatch',
            severity: 'medium',
            referenceId: ref.id,
            elementName: ref.name,
            expected: stored.features.find(f => f.includes('outfit')) || 'previous outfit',
            actual: feature,
            scenes: [stored.lastSeenScene, ref.lastSeenScene!],
            description: `Character "${ref.name}" outfit changed: was "${stored.features.find(f => f.includes('outfit') || 'unknown')}", now "${feature}"`,
            suggestion: 'Show outfit change or maintain consistency',
          });
        } else if (!storedHasFeature && (feature.includes('hair') || feature.includes('injury') || feature.includes('scar'))) {
          const featureKey = feature.split(':')[0] ?? feature;
          mismatches.push({
            type: 'feature-mismatch',
            severity: 'high',
            referenceId: ref.id,
            elementName: ref.name,
            expected: stored.features.find(f => f.includes(featureKey)) || 'previous feature',
            actual: feature,
            scenes: [stored.lastSeenScene, ref.lastSeenScene!],
            description: `Character "${ref.name}" physical feature changed: ${feature}`,
            suggestion: 'Explain physical change (injury, magic, time jump) or fix',
          });
        }
      }

      // Check age progression
      const ageFeature = ref.features.find(f => f.includes('age'));
      const storedAgeFeature = stored.features.find(f => f.includes('age'));
      if (ageFeature && storedAgeFeature && ageFeature !== storedAgeFeature) {
        mismatches.push({
          type: 'age-mismatch',
          severity: 'medium',
          referenceId: ref.id,
          elementName: ref.name,
          expected: storedAgeFeature,
          actual: ageFeature,
          scenes: [stored.lastSeenScene, ref.lastSeenScene!],
          description: `Character "${ref.name}" age changed from "${storedAgeFeature}" to "${ageFeature}"`,
          suggestion: 'Verify age consistency or show time passage',
        });
      }
    }
  }

  /**
   * Check location visual consistency
   */
  private checkLocationVisuals(
    sceneRefs: VisualReference[],
    input: SceneGenerationInput,
    context: SkillContext,
    mismatches: VisualMismatch[]
  ): void {
    const locRefs = sceneRefs.filter(r => r.type === 'location');
    
    for (const ref of locRefs) {
      const stored = this.referenceStore.get(ref.id);
      if (!stored) continue;

      // Check for terrain/climate mismatches
      for (const feature of ref.features) {
        const storedHasFeature = stored.features.some(f => this.fuzzyMatch(f, feature, this.config.fuzzyThreshold));
        if (!storedHasFeature && (feature.includes('terrain') || feature.includes('climate') || feature.includes('landmark'))) {
          const featureKey = feature.split(':')[0] ?? feature;
          mismatches.push({
            type: 'feature-mismatch',
            severity: 'medium',
            referenceId: ref.id,
            elementName: ref.name,
            expected: stored.features.find(f => f.includes(featureKey)) || 'previous description',
            actual: feature,
            scenes: [stored.lastSeenScene, ref.lastSeenScene!],
            description: `Location "${ref.name}" feature changed: ${feature}`,
            suggestion: 'Maintain location consistency or show environmental change',
          });
        }
      }
    }
  }

  /**
   * Check prop visual consistency
   */
  private checkPropVisuals(
    sceneRefs: VisualReference[],
    mismatches: VisualMismatch[]
  ): void {
    const propRefs = sceneRefs.filter(r => r.type === 'prop');
    
    for (const ref of propRefs) {
      const stored = this.referenceStore.get(ref.id);
      if (!stored) continue;

      for (const feature of ref.features) {
        const storedHasFeature = stored.features.some(f => this.fuzzyMatch(f, feature, this.config.fuzzyThreshold));
        if (!storedHasFeature && (feature.includes('color') || feature.includes('damage') || feature.includes('condition'))) {
          const featureKey = feature.split(':')[0] ?? feature;
          mismatches.push({
            type: feature.includes('damage') ? 'damage-mismatch' : 'color-mismatch',
            severity: feature.includes('damage') ? 'high' : 'medium',
            referenceId: ref.id,
            elementName: ref.name,
            expected: stored.features.find(f => f.includes(featureKey)) || 'previous state',
            actual: feature,
            scenes: [stored.lastSeenScene, ref.lastSeenScene!],
            description: `Prop "${ref.name}" visual state changed: ${feature}`,
            suggestion: 'Track prop damage/color changes explicitly',
          });
        }
      }
    }
  }

  /**
   * Check lighting consistency
   */
  private checkLightingConsistency(
    sceneRefs: VisualReference[],
    input: SceneGenerationInput,
    mismatches: VisualMismatch[]
  ): void {
    const lightingRefs = sceneRefs.filter(r => r.type === 'lighting');
    
    for (const ref of lightingRefs) {
      const stored = this.referenceStore.get(ref.id);
      if (!stored) continue;

      // Compare time of day
      const refTime = ref.features.find(f => f.includes('time:'));
      const storedTime = stored.features.find(f => f.includes('time:'));
      
      if (refTime && storedTime && refTime !== storedTime) {
        // Check if time jump is reasonable
        const refHour = this.timeToHour(refTime);
        const storedHour = this.timeToHour(storedTime);
        
        if (refHour !== undefined && storedHour !== undefined) {
          const diff = Math.abs(refHour - storedHour);
          if (diff > 6) { // More than 6 hours
            mismatches.push({
              type: 'lighting-mismatch',
              severity: 'low',
              referenceId: ref.id,
              elementName: 'scene lighting',
              expected: storedTime,
              actual: refTime,
              scenes: [stored.lastSeenScene, ref.lastSeenScene!],
              description: `Significant time jump affects lighting: ${storedTime} -> ${refTime}`,
              suggestion: 'Verify time progression or add transition',
            });
          }
        }
      }
    }
  }

  /**
   * Fuzzy string matching
   */
  private fuzzyMatch(str1: string, str2: string, threshold: number): boolean {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return true;
    if (s1.includes(s2) || s2.includes(s1)) return true;
    
    // Simple word overlap
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const common = words1.filter(w => words2.includes(w)).length;
    const total = new Set([...words1, ...words2]).size;
    
    return total > 0 && common / total >= threshold;
  }

  /**
   * Convert time string to hour
   */
  private timeToHour(timeStr: string): number | undefined {
    const times: Record<string, number> = {
      'time: dawn': 6,
      'time: morning': 9,
      'time: noon': 12,
      'time: afternoon': 15,
      'time: evening': 18,
      'time: dusk': 20,
      'time: night': 22,
      'time: midnight': 0,
    };
    return times[timeStr.toLowerCase()];
  }

  /**
   * Get all tracked references
   */
  getTrackedReferences(): VisualReference[] {
    return Array.from(this.referenceStore.values());
  }

  /**
   * Clear reference store (for testing)
   */
  clearStore(): void {
    this.referenceStore.clear();
  }
}

/**
 * Factory for creating VisualReferenceMatcher
 */
export async function createVisualReferenceMatcher(
  config?: Partial<VisualReferenceMatcherConfig>
): Promise<VisualReferenceMatcher> {
  const skill = new VisualReferenceMatcher();
  await skill.initialize(config);
  return skill;
}