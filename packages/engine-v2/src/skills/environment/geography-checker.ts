/**
 * Suro-Buya Engine v2 - Geography Checker Skill
 * 
 * Validates geographical consistency in scenes.
 */

import { z } from 'zod';
import type { SkillContext, SkillResult } from '../base.js';
import { EnvironmentSkill } from '../base.js';
import type { WorldProfile, SceneGenerationInput } from '../../types.js';

/**
 * Geography Checker configuration
 */
export interface GeographyCheckerConfig extends Record<string, unknown> {
  /** Check location existence */
  checkLocationExists: boolean;
  /** Check travel time consistency */
  checkTravelTime: boolean;
  /** Check climate consistency */
  checkClimate: boolean;
  /** Check terrain consistency */
  checkTerrain: boolean;
  /** Known locations database */
  knownLocations: string[];
}

/**
 * Geography analysis result
 */
export interface GeographyAnalysis {
  /** Scene location */
  location: string;
  /** Location exists in world bible */
  locationExists: boolean;
  /** Travel time from previous scene (minutes) */
  travelTimeMinutes?: number;
  /** Climate consistency */
  climateConsistent: boolean;
  /** Terrain consistency */
  terrainConsistent: boolean;
  /** Issues detected */
  issues: GeographyIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Geography issue
 */
export interface GeographyIssue {
  /** Issue type */
  type: 'unknown-location' | 'impossible-travel' | 'climate-mismatch' | 'terrain-mismatch' | 'distance-inconsistency';
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Description */
  description: string;
  /** Suggestion */
  suggestion: string;
}

/**
 * Geography Checker Skill
 * Validates geographical consistency
 */
export class GeographyChecker extends EnvironmentSkill<SceneGenerationInput, GeographyAnalysis> {
  override name = 'GeographyChecker';
  override version = '1.0.0';
  override description = 'Validates geographical consistency in scenes';
  override dependencies: string[] = ['LoreKeeper'];
  override required = false;
  
  override configSchema = z.object({
    checkLocationExists: z.boolean().default(true),
    checkTravelTime: z.boolean().default(true),
    checkClimate: z.boolean().default(true),
    checkTerrain: z.boolean().default(true),
    knownLocations: z.array(z.string()).default([]),
  });

  override defaultConfig: Record<string, unknown> = {
    checkLocationExists: true,
    checkTravelTime: true,
    checkClimate: true,
    checkTerrain: true,
    knownLocations: [],
  };

  protected override config: GeographyCheckerConfig = {
    checkLocationExists: true,
    checkTravelTime: true,
    checkClimate: true,
    checkTerrain: true,
    knownLocations: [],
  };

  async execute(input: SceneGenerationInput, context: SkillContext): Promise<SkillResult<GeographyAnalysis>> {
    const startTime = Date.now();
    const cfg = this.config;
    
    try {
      const issues: GeographyIssue[] = [];
      const recommendations: string[] = [];

      // Check if location exists in world bibles
      let locationExists = false;
      let worldWithLocation: WorldProfile | undefined;
      
      for (const world of Object.values(context.worldBibles)) {
        if (this.locationExistsInWorld(input.location, world)) {
          locationExists = true;
          worldWithLocation = world;
          break;
        }
      }

      // Also check known locations from config
      if (!locationExists && cfg.knownLocations.includes(input.location)) {
        locationExists = true;
      }

      if (!locationExists && cfg.checkLocationExists) {
        issues.push({
          type: 'unknown-location',
          severity: 'high',
          description: `Location "${input.location}" not found in any world bible`,
          suggestion: `Add "${input.location}" to world bible or check spelling`,
        });
        recommendations.push('Define location in world bible before use');
      }

      // Check travel time from previous scene
      let travelTimeMinutes: number | undefined;
      if (cfg.checkTravelTime && context.previousScenes && context.previousScenes.length > 0) {
        const prevSceneId = context.previousScenes[context.previousScenes.length - 1];
        // In real implementation, would look up previous scene location
        // For now, estimate based on scene number gap
        travelTimeMinutes = this.estimateTravelTime(input.sceneNumber, context);
        
        if (travelTimeMinutes > 120) { // More than 2 hours
          issues.push({
            type: 'impossible-travel',
            severity: 'medium',
            description: `Travel time to ${input.location} estimated at ${travelTimeMinutes} minutes`,
            suggestion: 'Add transition scene or justify rapid travel',
          });
        }
      }

      // Check climate consistency
      let climateConsistent = true;
      if (cfg.checkClimate && worldWithLocation) {
        climateConsistent = this.checkClimateConsistency(input, worldWithLocation, issues);
      }

      // Check terrain consistency
      let terrainConsistent = true;
      if (cfg.checkTerrain && worldWithLocation) {
        terrainConsistent = this.checkTerrainConsistency(input, worldWithLocation, issues);
      }

      // Generate recommendations
      if (!locationExists) {
        recommendations.push(`Add "${input.location}" to world bible with geography details`);
      }
      if (!climateConsistent) {
        recommendations.push('Align scene time of day with location climate');
      }
      if (!terrainConsistent) {
        recommendations.push('Ensure action fits location terrain');
      }

      const analysis: GeographyAnalysis = {
        location: input.location,
        locationExists,
        travelTimeMinutes,
        climateConsistent,
        terrainConsistent,
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
   * Check if location exists in world
   */
  private locationExistsInWorld(location: string, world: WorldProfile): boolean {
    const locationLower = location.toLowerCase();
    
    // Check geography landmarks
    if (world.geography?.landmarks) {
      for (const landmark of world.geography.landmarks) {
        if (landmark.toLowerCase().includes(locationLower) || locationLower.includes(landmark.toLowerCase())) {
          return true;
        }
      }
    }

    // Check connections
    if (world.connections) {
      for (const conn of world.connections) {
        if (conn.toLowerCase().includes(locationLower) || locationLower.includes(conn.toLowerCase())) {
          return true;
        }
      }
    }

    // Check world name
    if (world.name.toLowerCase().includes(locationLower) || locationLower.includes(world.name.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Estimate travel time between scenes
   */
  private estimateTravelTime(sceneNumber: number, context: SkillContext): number {
    // Simplified estimation - in reality would use actual locations
    const baseTime = 15; // minutes
    const sceneGap = sceneNumber > 1 ? sceneNumber - 1 : 0;
    return baseTime + (sceneGap * 10);
  }

  /**
   * Check climate consistency
   */
  private checkClimateConsistency(
    input: SceneGenerationInput,
    world: WorldProfile,
    issues: GeographyIssue[]
  ): boolean {
    if (!world.geography?.climate) return true;

    const climate = world.geography.climate.toLowerCase();
    const timeOfDay = input.timeOfDay.toLowerCase();
    let consistent = true;

    // Check for climate/time contradictions
    if (climate.includes('arctic') || climate.includes('polar') || climate.includes('frozen')) {
      if (timeOfDay.includes('noon') || timeOfDay.includes('afternoon')) {
        // Could be fine - just cold
      }
    }

    if (climate.includes('desert') || climate.includes('arid')) {
      if (timeOfDay.includes('night') || timeOfDay.includes('midnight')) {
        // Desert nights are cold - could mention
      }
    }

    if (climate.includes('tropical') || climate.includes('rainforest')) {
      if (timeOfDay.includes('dawn') || timeOfDay.includes('morning')) {
        // Humid mornings - consistent
      }
    }

    return consistent;
  }

  /**
   * Check terrain consistency
   */
  private checkTerrainConsistency(
    input: SceneGenerationInput,
    world: WorldProfile,
    issues: GeographyIssue[]
  ): boolean {
    if (!world.geography?.terrain) return true;

    const terrain = world.geography.terrain.map(t => t.toLowerCase());
    const beats = input.keyBeats.join(' ').toLowerCase();
    let consistent = true;

    // Check for terrain contradictions in beats
    if (terrain.includes('mountain') || terrain.includes('cliff')) {
      if (beats.includes('flat') || beats.includes('plain') || beats.includes('level ground')) {
        issues.push({
          type: 'terrain-mismatch',
          severity: 'medium',
          description: 'Scene describes flat terrain but location is mountainous',
          suggestion: 'Adjust action to fit mountainous terrain',
        });
        consistent = false;
      }
    }

    if (terrain.includes('swamp') || terrain.includes('marsh') || terrain.includes('bog')) {
      if (beats.includes('dry') || beats.includes('solid ground') || beats.includes('firm footing')) {
        issues.push({
          type: 'terrain-mismatch',
          severity: 'medium',
          description: 'Scene describes dry/solid ground but location is swampy',
          suggestion: 'Include mud, water, unstable footing in action',
        });
        consistent = false;
      }
    }

    if (terrain.includes('forest') || terrain.includes('woods') || terrain.includes('jungle')) {
      if (beats.includes('open field') || beats.includes('clearing') || beats.includes('vast expanse')) {
        // Could be a clearing - not necessarily inconsistent
      }
    }

    if (terrain.includes('urban') || terrain.includes('city')) {
      if (beats.includes('wilderness') || beats.includes('untamed') || beats.includes('no buildings')) {
        issues.push({
          type: 'terrain-mismatch',
          severity: 'medium',
          description: 'Scene describes wilderness but location is urban',
          suggestion: 'Include urban elements: buildings, streets, crowds',
        });
        consistent = false;
      }
    }

    return consistent;
  }
}

/**
 * Factory for creating GeographyChecker
 */
export async function createGeographyChecker(
  config?: Partial<GeographyCheckerConfig>
): Promise<GeographyChecker> {
  const skill = new GeographyChecker();
  await skill.initialize(config);
  return skill;
}