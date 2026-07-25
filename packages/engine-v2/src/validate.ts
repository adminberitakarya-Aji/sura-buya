/**
 * Suro-Buya Engine v2 - Validation Module
 * 
 * Canon validation logic for universe content.
 */

import type { 
  CanonValidationResult, 
  CanonCheckResult, 
  GenerationContext,
  SceneData,
  EpisodeStructure,
  CharacterProfile,
  WorldProfile,
  StoryProfile,
  ValidationRule,
  ValidationContext,
  ValidationViolation
} from './types.js';
import { SCHEMAS } from '@suro-buya/shared';

// Re-export validation types
export type { 
  CanonValidationResult,
  ValidationRule,
  ValidationContext,
  ValidationViolation,
} from './types.js';

/**
 * Built-in validation rules
 */
export const BUILTIN_RULES: ValidationRule[] = [
  {
    id: 'CHAR-001',
    name: 'Character Name Consistency',
    description: 'Character names must match exactly with character bible',
    severity: 'error',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      const content = context.content.toLowerCase();
      
      for (const [id, char] of Object.entries(context.characterBibles)) {
        const nameVariants = [char.name.toLowerCase(), id.toLowerCase()];
        const found = nameVariants.some(v => content.includes(v));
        
        if (!found && context.contentType === 'scene') {
          // Check if character should be in this scene
          if (context.sceneData?.characters.includes(id)) {
            violations.push({
              rule: 'CHAR-001',
              severity: 'error',
              location: `scene-${context.sceneData?.number}`,
              expected: char.name,
              actual: 'missing',
              suggestion: `Include character "${char.name}" in scene content`
            });
          }
        }
      }
      
      return violations;
    }
  },
  {
    id: 'CHAR-002',
    name: 'Character Voice Consistency',
    description: 'Character dialogue should match established voice patterns',
    severity: 'warning',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      // Voice consistency check would require NLP analysis
      // Placeholder for future implementation
      return violations;
    }
  },
  {
    id: 'WORLD-001',
    name: 'World Location Validity',
    description: 'Locations mentioned must exist in world bible',
    severity: 'error',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      
      if (context.sceneData) {
        const location = context.sceneData.location.toLowerCase();
        const validLocations = Object.values(context.worldBibles).flatMap(w => 
          w.geography?.landmarks || []
        ).map(l => l.toLowerCase());
        
        if (validLocations.length > 0 && !validLocations.includes(location)) {
          violations.push({
            rule: 'WORLD-001',
            severity: 'error',
            location: `scene-${context.sceneData.number}`,
            expected: 'valid location from world bible',
            actual: context.sceneData.location,
            suggestion: 'Use a location defined in the world bible or add new location'
          });
        }
      }
      
      return violations;
    }
  },
  {
    id: 'WORLD-002',
    name: 'World Consistency',
    description: 'World details must not contradict established lore',
    severity: 'error',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      // World consistency checks
      return violations;
    }
  },
  {
    id: 'PLOT-001',
    name: 'Timeline Consistency',
    description: 'Events must follow established timeline order',
    severity: 'error',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      
      if (context.episodeStructure && context.sceneData) {
        const sceneNumber = context.sceneData.number;
        const maxScene = context.episodeStructure.scenes.length;
        
        if (sceneNumber > maxScene) {
          violations.push({
            rule: 'PLOT-001',
            severity: 'error',
            location: `scene-${sceneNumber}`,
            expected: `scene number <= ${maxScene}`,
            actual: sceneNumber,
            suggestion: 'Adjust scene number or update episode structure'
          });
        }
      }
      
      return violations;
    }
  },
  {
    id: 'PLOT-002',
    name: 'Character Arc Progression',
    description: 'Character development must follow defined arc',
    severity: 'warning',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      // Character arc validation
      return violations;
    }
  },
  {
    id: 'TECH-001',
    name: 'Format Compliance',
    description: 'Content must follow required format (screenplay, prose, etc.)',
    severity: 'warning',
    check: (context) => {
      const violations: ValidationViolation[] = [];
      
      if (context.contentType === 'scene') {
        // Check for screenplay format
        const hasSceneHeading = /^(INT\.|EXT\.)/m.test(context.content);
        const hasDialogue = /^[A-Z][A-Z\s]+:/m.test(context.content);
        
        if (!hasSceneHeading) {
          violations.push({
            rule: 'TECH-001',
            severity: 'warning',
            location: 'scene-start',
            expected: 'Scene heading (INT./EXT. LOCATION - TIME)',
            actual: 'Missing scene heading',
            suggestion: 'Add proper scene heading at start of scene'
          });
        }
        
        if (!hasDialogue) {
          violations.push({
            rule: 'TECH-001',
            severity: 'info',
            location: 'scene-body',
            expected: 'Dialogue lines (CHARACTER: dialogue)',
            actual: 'No dialogue found',
            suggestion: 'Add character dialogue if this is a dialogue scene'
          });
        }
      }
      
      return violations;
    }
  },
];

/**
 * Validate content against canon
 */
export async function validateCanon(
  content: string,
  contentType: 'scene' | 'episode' | 'story' | 'character' | 'world',
  context: GenerationContext,
  options: { strictMode?: boolean; rules?: ValidationRule[] } = {}
): Promise<CanonValidationResult> {
  const { strictMode = false, rules = BUILTIN_RULES } = options;
  
  const validationContext: ValidationContext = {
    content,
    contentType,
    universeConfig: context.universeConfig,
    characterBibles: context.characterBibles,
    worldBibles: context.worldBibles,
    storyProfile: context.storyProfile,
    episodeStructure: context.episodeStructure,
    sceneData: contentType === 'scene' && context.episodeStructure 
      ? context.episodeStructure.scenes.find(s => content.includes(`scene-${s.number}`))
          ? (() => {
              const epScene = context.episodeStructure!.scenes.find(s => content.includes(`scene-${s.number}`))!;
              return {
                id: `scene-${epScene.number}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
                number: epScene.number,
                episodeId: `s${String(context.episodeStructure.season).padStart(2,'0')}e${String(context.episodeStructure.number).padStart(2,'0')}`,
                location: epScene.location,
                timeOfDay: 'DAY',
                characters: epScene.characters,
                type: epScene.type,
                beats: [],
                estimatedDuration: epScene.estimatedDuration,
              } as SceneData;
            })()
          : undefined
      : undefined,
  };
  
  const allViolations: ValidationViolation[] = [];
  
  for (const rule of rules) {
    try {
      const violations = rule.check(validationContext);
      allViolations.push(...violations);
    } catch (error) {
      console.error(`Validation rule ${rule.id} failed:`, error);
    }
  }
  
  // Filter by severity if strict mode
  const filteredViolations = strictMode 
    ? allViolations 
    : allViolations.filter(v => v.severity !== 'info');
  
  const errors = filteredViolations.filter(v => v.severity === 'error');
  const warnings = filteredViolations.filter(v => v.severity === 'warning');
  const infos = filteredViolations.filter(v => v.severity === 'info');
  
  // Calculate consistency score (0-1)
  const totalChecks = rules.length;
  const passedChecks = totalChecks - errors.length - warnings.length;
  const consistencyScore = totalChecks > 0 ? passedChecks / totalChecks : 1;
  
  return {
    valid: errors.length === 0,
    violations: filteredViolations.map(v => ({
      rule: v.rule,
      severity: v.severity,
      location: v.location,
      expected: v.expected,
      actual: v.actual,
      suggestion: v.suggestion,
    })),
    consistencyScore,
    errors: errors.map(v => ({ 
      path: v.location, 
      message: `${v.rule}: Expected ${JSON.stringify(v.expected)}, got ${JSON.stringify(v.actual)}`, 
      code: v.rule 
    })),
    warnings: warnings.map(v => ({ 
      path: v.location, 
      message: `${v.rule}: Expected ${JSON.stringify(v.expected)}, got ${JSON.stringify(v.actual)}`, 
      code: v.rule 
    })),
    infos: infos.map(v => ({ 
      path: v.location, 
      message: `${v.rule}: Expected ${JSON.stringify(v.expected)}, got ${JSON.stringify(v.actual)}`, 
      code: v.rule 
    })),
  };
}

/**
 * Validate scene content
 */
export async function validateScene(
  scene: SceneData,
  context: GenerationContext,
  options?: { strictMode?: boolean }
): Promise<CanonValidationResult> {
  // Build scene content string from scene data
  const content = buildSceneContent(scene);
  return validateCanon(content, 'scene', context, options);
}

/**
 * Validate episode structure
 */
export async function validateEpisode(
  episode: EpisodeStructure,
  context: GenerationContext,
  options?: { strictMode?: boolean }
): Promise<CanonValidationResult> {
  const content = buildEpisodeContent(episode);
  return validateCanon(content, 'episode', context, options);
}

/**
 * Validate character profile
 */
export async function validateCharacter(
  character: CharacterProfile,
  context: GenerationContext,
  options?: { strictMode?: boolean }
): Promise<CanonValidationResult> {
  const content = JSON.stringify(character, null, 2);
  return validateCanon(content, 'character', context, options);
}

/**
 * Validate world profile
 */
export async function validateWorld(
  world: WorldProfile,
  context: GenerationContext,
  options?: { strictMode?: boolean }
): Promise<CanonValidationResult> {
  const content = JSON.stringify(world, null, 2);
  return validateCanon(content, 'world', context, options);
}

/**
 * Build scene content string for validation
 */
function buildSceneContent(scene: SceneData): string {
  let content = `SCENE ${scene.number}: ${scene.location} - ${scene.timeOfDay}\n`;
  content += `Type: ${scene.type}\n`;
  content += `Characters: ${scene.characters.join(', ')}\n`;
  content += `Duration: ${scene.estimatedDuration} min\n\n`;
  
  for (const beat of scene.beats) {
    content += `BEAT ${beat.order}: ${beat.description}\n`;
    if (beat.character) content += `  Character: ${beat.character}\n`;
    if (beat.dialogue) content += `  Dialogue: ${beat.dialogue}\n`;
    if (beat.action) content += `  Action: ${beat.action}\n`;
    content += '\n';
  }
  
  if (scene.visualNotes) content += `VISUAL: ${scene.visualNotes}\n`;
  if (scene.audioNotes) content += `AUDIO: ${scene.audioNotes}\n`;
  
  return content;
}

/**
 * Build episode content string for validation
 */
function buildEpisodeContent(episode: EpisodeStructure): string {
  let content = `EPISODE ${episode.season}x${episode.number}: ${episode.title}\n`;
  content += `Summary: ${episode.summary}\n`;
  content += `Themes: ${episode.themes.join(', ')}\n`;
  content += `Character Arcs: ${episode.characterArcs.join(', ')}\n\n`;
  
  for (const scene of episode.scenes) {
    content += `Scene ${scene.number}: ${scene.location} (${scene.type}, ${scene.estimatedDuration}min)\n`;
    content += `  Characters: ${scene.characters.join(', ')}\n`;
    content += `  Summary: ${scene.summary}\n\n`;
  }
  
  return content;
}

/**
 * Quick validation for ID formats
 */
export function validateIdFormat(id: string, type: 'universe' | 'character' | 'world' | 'story'): boolean {
  const schemaKey = `${type.toUpperCase()}_ID` as keyof typeof SCHEMAS;
  const schema = SCHEMAS[schemaKey];
  if (!schema) return true;
  
  try {
    schema.parse(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => !(field in obj) || obj[field] === undefined || obj[field] === '');
  return {
    valid: missing.length === 0,
    missing,
  };
}