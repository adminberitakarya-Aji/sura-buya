/**
 * Suro-Buya Engine v2 - Canon Validator
 * 
 * Canon validation with RuleEngine (deterministic) + LLMJudge (semantic) pipelines.
 */

import { z } from 'zod';
import type { 
  ValidationContext, 
  ValidationViolation, 
  CanonValidationResult,
  GenerationContext,
  SceneData,
  CharacterProfile,
  WorldProfile,
  StoryProfile,
  EpisodeStructure,
  UniverseConfig,
  GenerationOptions,
} from '../types.js';
import { ProviderRegistry, AITask, createDefaultRegistryConfig, createProviderFactory } from '../ai/registry.js';
import type { AIProvider, AIProviderOptions } from '../ai/providers.js';

// Extended types for canon validation (adding fields not in base types)
interface ExtendedUniverseConfig extends UniverseConfig {
  genre?: string[];
  tone?: string;
  canonRules?: string[];
}

interface ExtendedWorldProfile extends WorldProfile {
  rules?: string[];
  locations?: Array<{ name: string; description: string }>;
}

interface ExtendedSceneData extends SceneData {
  content?: string;
}

/**
 * Rule definition for deterministic validation
 */
export interface CanonRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: ValidationContext) => ValidationViolation[];
}

/**
 * Rule engine for deterministic canon validation
 */
export class RuleEngine {
  private rules: Map<string, CanonRule> = new Map();

  constructor(rules: CanonRule[] = []) {
    for (const rule of rules) {
      this.addRule(rule);
    }
  }

  /**
   * Add a validation rule
   */
  addRule(rule: CanonRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get all registered rules
   */
  getRules(): CanonRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Run all rules against a validation context
   */
  validate(context: ValidationContext): ValidationViolation[] {
    const violations: ValidationViolation[] = [];
    
    for (const rule of this.rules.values()) {
      try {
        const ruleViolations = rule.check(context);
        violations.push(...ruleViolations);
      } catch (error) {
        violations.push({
          rule: rule.id,
          severity: 'error',
          location: 'rule-engine',
          expected: 'rule execution',
          actual: `Error: ${(error as Error).message}`,
        });
      }
    }

    return violations;
  }
}

/**
 * LLM-based semantic judge for canon validation
 */
export class LLMJudge {
  private provider: AIProvider;
  private providerOptions: AIProviderOptions;

  constructor(provider: AIProvider, options: AIProviderOptions = {}) {
    this.provider = provider;
    this.providerOptions = options;
  }

  /**
   * Judge semantic consistency of content against canon
   */
  async judge(
    content: string,
    context: ValidationContext,
    criteria: JudgingCriteria
  ): Promise<JudgeResult> {
    const prompt = this.buildJudgingPrompt(content, context, criteria);
    
    const options: AIProviderOptions = {
      ...this.providerOptions,
      model: this.providerOptions.model || 'claude-3-5-sonnet-20241022',
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: this.getSystemPrompt(),
    };
    
    const response = await this.provider.generate(prompt, options);

    return this.parseJudgeResponse(response.content);
  }

  /**
   * Build the judging prompt
   */
  private buildJudgingPrompt(
    content: string,
    context: ValidationContext,
    criteria: JudgingCriteria
  ): string {
    const canonContext = this.formatCanonContext(context);
    
    return `
CONTENT TO VALIDATE:
---
${content}
---

CANON CONTEXT:
---
${canonContext}
---

JUDGING CRITERIA:
${criteria.map(c => `- ${c.name}: ${c.description} (weight: ${c.weight})`).join('\n')}

Please evaluate the content against the canon context for each criterion. 
Return a JSON object with:
{
  "scores": { "criterionName": 0.0-1.0 },
  "violations": [{ "criterion": "name", "severity": "error|warning|info", "location": "text location", "expected": "...", "actual": "...", "suggestion": "..." }],
  "overallScore": 0.0-1.0,
  "summary": "Brief assessment"
}`;
  }

  /**
   * Format canon context for the judge
   */
  private formatCanonContext(context: ValidationContext): string {
    const parts: string[] = [];

    if (context.universeConfig) {
      const extUniverse = context.universeConfig as ExtendedUniverseConfig;
      parts.push(`UNIVERSE: ${context.universeConfig.name}`);
      parts.push(`GENRE: ${extUniverse.genre?.join(', ') || 'N/A'}`);
      parts.push(`TONE: ${extUniverse.tone || 'N/A'}`);
      if (extUniverse.canonRules && extUniverse.canonRules.length > 0) {
        parts.push('CANON RULES:');
        for (const rule of extUniverse.canonRules) {
          parts.push(`  - ${rule}`);
        }
      }
    }

    if (context.characterBibles && Object.keys(context.characterBibles).length > 0) {
      parts.push('\nCHARACTERS:');
      for (const [id, char] of Object.entries(context.characterBibles)) {
        parts.push(`  ${char.name} (${char.archetype}): ${char.description}`);
        if (char.traits.length > 0) {
          parts.push(`    Traits: ${char.traits.join(', ')}`);
        }
        if (char.voice && char.voice.vocabulary) {
          parts.push(`    Vocabulary: ${char.voice.vocabulary.join(', ')}`);
        }
      }
    }

    if (context.worldBibles && Object.keys(context.worldBibles).length > 0) {
      parts.push('\nWORLD:');
      for (const [id, world] of Object.entries(context.worldBibles)) {
        const extWorld = world as ExtendedWorldProfile;
        parts.push(`  ${world.name}: ${world.description}`);
        if (extWorld.rules && extWorld.rules.length > 0) {
          parts.push(`    Rules: ${extWorld.rules.join('; ')}`);
        }
      }
    }

    if (context.storyProfile) {
      parts.push(`\nSTORY: ${context.storyProfile.logline}`);
      parts.push(`THEMES: ${context.storyProfile.themes.join(', ')}`);
    }

    if (context.episodeStructure) {
      parts.push(`\nEPISODE: ${context.episodeStructure.title} - ${context.episodeStructure.summary}`);
    }

    if (context.sceneData) {
      const extScene = context.sceneData as ExtendedSceneData;
      parts.push(`\nSCENE: ${context.sceneData.location} (${context.sceneData.timeOfDay})`);
      parts.push(`CHARACTERS: ${context.sceneData.characters.join(', ')}`);
      parts.push(`BEATS: ${context.sceneData.beats.map(b => b.description).join('; ')}`);
      if (extScene.content) {
        parts.push(`CONTENT: ${extScene.content.substring(0, 500)}...`);
      }
    }

    return parts.join('\n');
  }

  /**
   * System prompt for the LLM judge
   */
  private getSystemPrompt(): string {
    return `You are a canon consistency judge for a TV series writing system. 
Your job is to evaluate generated content against established canon (characters, world rules, story arcs, tone).
Be strict but fair. Return only valid JSON as specified.`;
  }

  /**
   * Parse the judge's JSON response
   */
  private parseJudgeResponse(content: string): JudgeResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        scores: parsed.scores || {},
        violations: parsed.violations || [],
        overallScore: parsed.overallScore || 0,
        summary: parsed.summary || 'No summary provided',
      };
    } catch (error) {
      return {
        scores: {},
        violations: [{
          criterion: 'parsing',
          severity: 'error',
          location: 'llm-judge-response',
          expected: 'valid JSON',
          actual: content.substring(0, 200),
        }],
        overallScore: 0,
        summary: `Failed to parse judge response: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Judging criterion definition
 */
export interface JudgingCriterion {
  name: string;
  description: string;
  weight: number;
}

/**
 * Judging criteria set
 */
export type JudgingCriteria = JudgingCriterion[];

/**
 * Judge result
 */
export interface JudgeResult {
  scores: Record<string, number>;
  violations: JudgeViolation[];
  overallScore: number;
  summary: string;
}

export interface JudgeViolation {
  criterion: string;
  severity: 'error' | 'warning' | 'info';
  location: string;
  expected: string;
  actual: string;
  suggestion?: string;
}

/**
 * Default judging criteria
 */
export const DEFAULT_JUDGING_CRITERIA: JudgingCriteria = [
  {
    name: 'characterConsistency',
    description: 'Characters act and speak consistently with their established personalities, voices, and arcs',
    weight: 0.3,
  },
  {
    name: 'worldConsistency',
    description: 'Content respects established world rules, physics, magic systems, technology limits',
    weight: 0.25,
  },
  {
    name: 'storyContinuity',
    description: 'Events align with established plot points, character histories, and episode continuity',
    weight: 0.2,
  },
  {
    name: 'toneConsistency',
    description: 'Writing style matches the series tone, genre conventions, and emotional register',
    weight: 0.15,
  },
  {
    name: 'canonCompliance',
    description: 'No contradictions with explicitly stated canon facts, rules, or established lore',
    weight: 0.1,
  },
];

/**
 * Canon Validator - Main validation orchestrator
 */
export class CanonValidator {
  private ruleEngine: RuleEngine;
  private llmJudge?: LLMJudge;
  private useLLMJudge: boolean;

  constructor(
    ruleEngine: RuleEngine,
    llmJudge?: LLMJudge,
    useLLMJudge = true
  ) {
    this.ruleEngine = ruleEngine;
    this.llmJudge = llmJudge;
    this.useLLMJudge = useLLMJudge && !!llmJudge;
  }

  /**
   * Validate content against canon
   */
  async validate(
    content: string,
    context: ValidationContext,
    options: ValidationOptions = {}
  ): Promise<CanonValidationResult> {
    const allViolations: ValidationViolation[] = [];
    const errors: CanonValidationResult['errors'] = [];
    const warnings: CanonValidationResult['warnings'] = [];
    const infos: CanonValidationResult['infos'] = [];

    // Run deterministic rules
    const ruleViolations = this.ruleEngine.validate(context);
    allViolations.push(...ruleViolations);

    // Run LLM judge if enabled
    let judgeResult: JudgeResult | undefined;
    if (this.useLLMJudge && this.llmJudge && options.enableLLMJudge !== false) {
      judgeResult = await this.llmJudge.judge(content, context, options.judgingCriteria || DEFAULT_JUDGING_CRITERIA);
      
      // Convert judge violations to standard format
      for (const v of judgeResult.violations) {
        allViolations.push({
          rule: `llm-judge:${v.criterion}`,
          severity: v.severity,
          location: v.location,
          expected: v.expected,
          actual: v.actual,
          suggestion: v.suggestion,
        });
      }
    }

    // Categorize violations
    for (const violation of allViolations) {
      const categorized = {
        path: violation.location,
        message: `${violation.rule}: Expected ${JSON.stringify(violation.expected)}, got ${JSON.stringify(violation.actual)}`,
        code: violation.rule,
      };

      switch (violation.severity) {
        case 'error':
          errors.push(categorized);
          break;
        case 'warning':
          warnings.push(categorized);
          break;
        case 'info':
          infos.push(categorized);
          break;
      }
    }

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(allViolations, judgeResult);

    return {
      valid: errors.length === 0,
      consistencyScore,
      violations: allViolations,
      errors,
      warnings,
      infos,
    };
  }

  /**
   * Calculate consistency score from violations
   */
  private calculateConsistencyScore(
    violations: ValidationViolation[],
    judgeResult?: JudgeResult
  ): number {
    if (violations.length === 0 && (!judgeResult || judgeResult.overallScore >= 0.9)) {
      return 1.0;
    }

    let score = 1.0;
    
    // Deduct for violations
    for (const v of violations) {
      switch (v.severity) {
        case 'error': score -= 0.15; break;
        case 'warning': score -= 0.05; break;
        case 'info': score -= 0.01; break;
      }
    }

    // Factor in judge score
    if (judgeResult) {
      score = (score + judgeResult.overallScore) / 2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get rule engine for external access
   */
  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }

  /**
   * Set LLM judge
   */
  setLLMJudge(judge: LLMJudge): void {
    this.llmJudge = judge;
    this.useLLMJudge = true;
  }

  /**
   * Enable/disable LLM judge
   */
  setUseLLMJudge(enabled: boolean): void {
    this.useLLMJudge = enabled && !!this.llmJudge;
  }
}

/**
 * Validation options
 */
export interface ValidationOptions {
  enableLLMJudge?: boolean;
  judgingCriteria?: JudgingCriteria;
  strictMode?: boolean;
}

/**
 * Create default rule engine with built-in canon rules
 */
export function createDefaultRuleEngine(): RuleEngine {
  const rules: CanonRule[] = [
    {
      id: 'character-name-consistency',
      name: 'Character Name Consistency',
      description: 'Ensure character names match established canon',
      severity: 'error',
      check: (context) => {
        const violations: ValidationViolation[] = [];
        if (!context.characterBibles || !context.sceneData) return violations;

        for (const charName of context.sceneData.characters) {
          const char = context.characterBibles[charName];
          if (!char) {
            violations.push({
              rule: 'character-name-consistency',
              severity: 'warning',
              location: `scene.characters: ${charName}`,
              expected: 'known character from bible',
              actual: `unknown character: ${charName}`,
              suggestion: `Add ${charName} to character bible or fix spelling`,
            });
          }
        }
        return violations;
      },
    },
    {
      id: 'location-consistency',
      name: 'Location Consistency',
      description: 'Ensure scene locations exist in world bible',
      severity: 'warning',
      check: (context) => {
        const violations: ValidationViolation[] = [];
        if (!context.worldBibles || !context.sceneData) return violations;

        const location = context.sceneData.location;
        const knownLocations = Object.values(context.worldBibles).flatMap(w => 
          (w as ExtendedWorldProfile).locations?.map((l: { name: string }) => l.name) || []
        );
        
        if (knownLocations.length > 0 && !knownLocations.includes(location)) {
          violations.push({
            rule: 'location-consistency',
            severity: 'warning',
            location: `scene.location`,
            expected: 'known location from world bible',
            actual: location,
            suggestion: `Add ${location} to world bible or verify spelling`,
          });
        }
        return violations;
      },
    },
    {
      id: 'dialogue-character-voice',
      name: 'Dialogue Character Voice',
      description: 'Check dialogue matches character voice patterns',
      severity: 'info',
      check: (context) => {
        const violations: ValidationViolation[] = [];
        const extScene = context.sceneData as ExtendedSceneData;
        if (!context.characterBibles || !extScene.content) return violations;

        // This is a placeholder - real implementation would analyze dialogue
        // against character voice profiles (vocabulary, speech patterns, etc.)
        return violations;
      },
    },
    {
      id: 'scene-timeline-consistency',
      name: 'Scene Timeline Consistency',
      description: 'Ensure scene time of day and sequence makes sense',
      severity: 'warning',
      check: (context) => {
        const violations: ValidationViolation[] = [];
        if (!context.episodeStructure || !context.sceneData) return violations;

        const sceneIndex = context.episodeStructure.scenes.findIndex(s => s.number === context.sceneData!.number);
        if (sceneIndex > 0) {
          const prevScene = context.episodeStructure.scenes[sceneIndex - 1];
          // Could check time progression logic here
        }
        return violations;
      },
    },
    {
      id: 'forbidden-content',
      name: 'Forbidden Content Check',
      description: 'Check for content that violates series content guidelines',
      severity: 'error',
      check: (context) => {
        const violations: ValidationViolation[] = [];
        const extUniverse = context.universeConfig as ExtendedUniverseConfig;
        if (!extUniverse.canonRules) return violations;

        // Check against universe-specific forbidden patterns
        const extScene = context.sceneData as ExtendedSceneData;
        const content = extScene.content || '';
        for (const rule of extUniverse.canonRules) {
          if (rule.toLowerCase().includes('forbidden') || rule.toLowerCase().includes('never')) {
            // This would need more sophisticated pattern matching
          }
        }
        return violations;
      },
    },
  ];

  return new RuleEngine(rules);
}

/**
 * Create default LLM judge from provider registry
 */
export async function createDefaultLLMJudge(
  registry: ProviderRegistry
): Promise<LLMJudge | null> {
  try {
    const selection = await registry.selectProvider('validation');
    return new LLMJudge(selection.provider, {
      model: selection.config.primary.model,
      temperature: 0.1,
    });
  } catch {
    return null;
  }
}

/**
 * Create default canon validator
 */
export async function createDefaultCanonValidator(
  registry: ProviderRegistry
): Promise<CanonValidator> {
  const ruleEngine = createDefaultRuleEngine();
  const llmJudge = await createDefaultLLMJudge(registry);
  
  return new CanonValidator(ruleEngine, llmJudge ?? undefined);
}
