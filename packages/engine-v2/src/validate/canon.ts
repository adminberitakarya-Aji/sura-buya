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
import type { VideoCharacterContext, ContentRating } from '@suro-buya/shared';

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

  // ============================================================
  // VF-5.2 — Canon check final sebelum export (video jadi)
  // Extend (bukan rewrite) — method baru untuk cek video final,
  // bukan cuma naskah. Reuse validateVideoScript() (VF-2.4) untuk
  // script, lalu tambah check shot descriptions & metadata video.
  // ============================================================

  /**
   * Validate video final against canon — cek video jadi (bukan cuma naskah).
   *
   * Ini adalah canon check final sebelum export (VF-5.2):
   * 1. Reuse validateVideoScript() (VF-2.4) untuk cek script final
   * 2. Tambah check shot descriptions/visual prompts konsisten persona
   * 3. Tambah check series continuity di level video jadi
   *
   * Acceptance criteria: "Video yang melanggar persona karakter atau
   * continuity series juga ter-flag, terpisah dari hasil content moderation"
   *
   * @param script Script final video
   * @param context Konteks video final (extend VideoCanonContext)
   * @param options Opsi validasi
   * @returns Hasil canon validation
   */
  async validateVideoFinal(
    script: string,
    context: VideoFinalCanonContext,
    options: ValidationOptions = {}
  ): Promise<CanonValidationResult> {
    const allViolations: ValidationViolation[] = [];
    const errors: CanonValidationResult['errors'] = [];
    const warnings: CanonValidationResult['warnings'] = [];
    const infos: CanonValidationResult['infos'] = [];

    // 1. Reuse validateVideoScript() (VF-2.4) untuk cek script final
    const scriptResult = await this.validateVideoScript(script, context, options);
    allViolations.push(...scriptResult.violations);

    // 2. Check shot descriptions/visual prompts konsisten persona
    if (context.shotDescriptions && context.shotDescriptions.length > 0) {
      const shotViolations = checkShotDescriptionConsistency(context);
      allViolations.push(...shotViolations);
    }

    // 3. Check visual prompts konsisten persona (jika ada)
    if (context.visualPrompts && context.visualPrompts.length > 0) {
      const visualViolations = checkVisualPromptConsistency(context);
      allViolations.push(...visualViolations);
    }

    // 4. Categorize violations
    for (const violation of allViolations) {
      const categorized = {
        path: violation.location,
        message: `${violation.rule}: Expected ${JSON.stringify(violation.expected)}, got ${JSON.stringify(violation.actual)}`,
        code: violation.rule,
      };
      switch (violation.severity) {
        case 'error': errors.push(categorized); break;
        case 'warning': warnings.push(categorized); break;
        case 'info': infos.push(categorized); break;
      }
    }

    const consistencyScore = calculateConsistencyScoreFromViolations(allViolations);

    return {
      valid: errors.length === 0,
      consistencyScore,
      violations: allViolations,
      errors,
      warnings,
      infos,
    };
  }

  // ============================================================
  // VF-2.4 — Video script canon check
  // Extend (bukan rewrite) — method baru untuk naskah video,
  // pakai VideoCharacterContext (VF-2.0), BUKAN CharacterProfile lama.
  // ============================================================

  /**
   * Validate video script against canon.
   *
   * Cek: (a) naskah konsisten dengan persona VideoCharacterContext
   *      (b) kalau series, konsisten dengan episode sebelumnya
   *
   * Acceptance criteria: "Naskah yang melanggar persona karakter
   * (karakter penakut tiba-tiba ditulis sangat pemberani tanpa alasan)
   * berhasil di-flag oleh canon check sebelum lanjut ke storyboard"
   */
  async validateVideoScript(
    script: string,
    context: VideoCanonContext,
    options: ValidationOptions = {}
  ): Promise<CanonValidationResult> {
    const allViolations: ValidationViolation[] = [];
    const errors: CanonValidationResult['errors'] = [];
    const warnings: CanonValidationResult['warnings'] = [];
    const infos: CanonValidationResult['infos'] = [];

    // 1. Run video-specific deterministic rules
    const videoViolations = runVideoCanonRules(script, context);
    allViolations.push(...videoViolations);

    // 2. Run LLM judge if enabled (semantic analysis)
    let judgeResult: JudgeResult | undefined;
    if (this.useLLMJudge && this.llmJudge && options.enableLLMJudge !== false) {
      judgeResult = await this.judgeVideoScript(script, context);
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

    // 3. Categorize violations
    for (const violation of allViolations) {
      const categorized = {
        path: violation.location,
        message: `${violation.rule}: Expected ${JSON.stringify(violation.expected)}, got ${JSON.stringify(violation.actual)}`,
        code: violation.rule,
      };
      switch (violation.severity) {
        case 'error': errors.push(categorized); break;
        case 'warning': warnings.push(categorized); break;
        case 'info': infos.push(categorized); break;
      }
    }

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
   * LLM judge for video script — semantic analysis of persona consistency.
   */
  private async judgeVideoScript(
    script: string,
    context: VideoCanonContext
  ): Promise<JudgeResult> {
    if (!this.llmJudge) {
      return { scores: {}, violations: [], overallScore: 1, summary: 'No LLM judge available' };
    }

    const char = context.character;
    const prompt = `NASKAH VIDEO:
---
${script}
---

KARAKTER:
- Nama: ${char.displayName}
- Peran: ${char.role}
- Sifat inti: ${char.coreTraits.join(', ')}
- Kelemahan utama: ${char.coreWeakness}
- Cara bicara: ${char.voiceGuide}
- Motivasi: ${char.metadata.motivation ?? 'Tidak spesifik'}

${context.seriesContext ? `EPISODE SEBELUMNYA:\n${context.seriesContext.previousEpisodeSummaries.join('\n')}` : 'Standalone video (bukan series).'}

Evaluasi naskah terhadap karakter di atas untuk kriteria berikut:
- characterConsistency: Karakter bertindak dan bicara konsisten dengan sifat inti dan kelemahan utama
- voiceConsistency: Dialog karakter sesuai dengan cara bicara yang ditetapkan
- storyContinuity: ${context.seriesContext ? 'Naskah konsisten dengan episode sebelumnya' : 'N/A (standalone)'}

Return JSON: { "scores": {...}, "violations": [...], "overallScore": 0-1, "summary": "..." }`;

    const options: AIProviderOptions = {
      ...this.llmJudge['providerOptions'],
      model: this.llmJudge['providerOptions'].model || 'claude-3-5-sonnet-20241022',
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: `You are a canon consistency judge for video scripts. Evaluate against character persona. Be strict but fair. Return only valid JSON.`,
    };

    const response = await this.llmJudge['provider'].generate(prompt, options);
    return this.parseVideoJudgeResponse(response.content);
  }

  /**
   * Parse LLM judge response for video script.
   */
  private parseVideoJudgeResponse(content: string): JudgeResult {
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

// ============================================================
// VF-2.4 — Video canon context & rules
// ============================================================

/**
 * Konteks untuk canon check naskah video.
 * Pakai VideoCharacterContext (VF-2.0), BUKAN CharacterProfile lama.
 */
export interface VideoCanonContext {
  /** Karakter utama — VideoCharacterContext (VF-2.0) */
  character: VideoCharacterContext;

  /** Rating universe pemanggil */
  contentRating: ContentRating;

  /** Profil audiens bebas teks */
  audienceProfile?: string;

  /** Konteks series — opsional, hanya kalau bagian VideoSeries */
  seriesContext?: {
    seriesId: string;
    episodeOrder: number;
    previousEpisodeSummaries: string[];
  };
}

/**
 * Run video-specific deterministic canon rules.
 * These are separate from the existing RuleEngine rules (which use
 * ValidationContext with CharacterProfile) — video rules use
 * VideoCanonContext with VideoCharacterContext directly.
 */
function runVideoCanonRules(script: string, context: VideoCanonContext): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const char = context.character;
  const scriptLower = script.toLowerCase();

  // Rule 1: Character name consistency — character name should appear in script
  if (!scriptLower.includes(char.displayName.toLowerCase()) &&
      !scriptLower.includes(char.characterId.toLowerCase())) {
    violations.push({
      rule: 'video-character-name-presence',
      severity: 'warning',
      location: 'script',
      expected: `character name "${char.displayName}" or "${char.characterId}" to appear in script`,
      actual: 'character name not found in script',
      suggestion: `Pastikan karakter "${char.displayName}" muncul di naskah`,
    });
  }

  // Rule 2: Core weakness contradiction — if character has a weakness,
  // check if the script directly contradicts it without explanation
  // Example: "penakut" (fearful) but script says "sangat pemberani" (very brave)
  if (char.coreWeakness) {
    const weaknessLower = char.coreWeakness.toLowerCase();

    // Extract key concept from weakness (e.g., "takut" from "Takut pada gelap")
    const weaknessKeywords = weaknessLower.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);

    // Check for direct antonyms/contradictions
    const contradictionPatterns: Record<string, string[]> = {
      'takut': ['sangat pemberani', 'tidak takut sama sekali', 'tanpa rasa takut', 'berani sekali', 'pemberani tanpa'],
      'penakut': ['sangat pemberani', 'tidak takut sama sekali', 'tanpa rasa takut', 'berani sekali', 'pemberani tanpa'],
      'lemah': ['sangat kuat', 'paling kuat', 'kekuatan luar biasa'],
      'pemalu': ['sangat percaya diri', 'tanpa rasa malu', 'berani tampil'],
      'ragu': ['sangat yakin', 'tanpa keraguan', 'pasti sekali'],
    };

    for (const keyword of weaknessKeywords) {
      const patterns = contradictionPatterns[keyword];
      if (patterns) {
        for (const pattern of patterns) {
          if (scriptLower.includes(pattern.toLowerCase())) {
            violations.push({
              rule: 'video-persona-weakness-contradiction',
              severity: 'error',
              location: `script: "${pattern}"`,
              expected: `karakter dengan kelemahan "${char.coreWeakness}" tidak tiba-tiba menjadi kebalikannya tanpa alasan`,
              actual: `naskah menggambarkan karakter sebagai "${pattern}" yang kontradiksi dengan kelemahan utama`,
              suggestion: `Berikan alasan/arc karakter yang menjelaskan perubahan ini, atau ubah agar konsisten dengan kelemahan "${char.coreWeakness}"`,
            });
          }
        }
      }
    }
  }

  // Rule 3: Core traits consistency — check if script directly contradicts core traits
  for (const trait of char.coreTraits) {
    const traitLower = trait.toLowerCase();

    // Map traits to their antonyms
    const traitContradictions: Record<string, string[]> = {
      'pemberani': ['penakut sekali', 'tidak berani sama sekali', 'lari ketakutan', 'menyerah karena takut'],
      'ingin tahu': ['tidak peduli sama sekali', 'acuh tak acuh', 'tidak tertarik'],
      'setia kawan': ['mengkhianati teman', 'meninggalkan teman', 'berkhianat'],
      'jujur': ['berbohong', 'berdusta', 'menipu'],
      'rajin': ['malas sekali', 'tidak mau bekerja'],
      'cerdas': ['bodoh sekali', 'tidak pintar sama sekali'],
      'pemalu': ['sangat pemberani', 'berani sekali'],
      'penakut': ['sangat pemberani', 'berani sekali', 'tanpa rasa takut'],
    };

    const patterns = traitContradictions[traitLower];
    if (patterns) {
      for (const pattern of patterns) {
        if (scriptLower.includes(pattern.toLowerCase())) {
          violations.push({
            rule: 'video-persona-trait-contradiction',
            severity: 'error',
            location: `script: "${pattern}"`,
            expected: `karakter dengan sifat "${trait}" tidak boleh digambarkan sebagai kebalikannya tanpa alasan`,
            actual: `naskah menggambarkan karakter dengan "${pattern}" yang kontradiksi dengan sifat inti "${trait}"`,
            suggestion: `Berikan alasan/arc karakter yang menjelaskan perilaku ini, atau ubah agar konsisten dengan sifat "${trait}"`,
          });
        }
      }
    }
  }

  // Rule 4: Series continuity — if part of series, check for obvious contradictions
  if (context.seriesContext && context.seriesContext.previousEpisodeSummaries.length > 0) {
    // Check if script references events from previous episodes
    // (This is a light heuristic check — LLM judge does deeper semantic analysis)
    const hasContinuityReference = context.seriesContext.previousEpisodeSummaries.some(summary => {
      // Extract key nouns from summary and check if any appear in script
      const nouns = summary.toLowerCase().split(/\s+/).filter((w: string) => w.length > 5).slice(0, 5);
      return nouns.some(noun => scriptLower.includes(noun));
    });

    if (!hasContinuityReference && context.seriesContext.episodeOrder > 1) {
      violations.push({
        rule: 'video-series-continuity-reference',
        severity: 'info',
        location: 'script',
        expected: 'naskah episode 2+ sebaiknya merujuk event dari episode sebelumnya',
        actual: 'tidak ditemukan referensi ke event episode sebelumnya',
        suggestion: 'Pertimbangkan menambahkan referensi ke event di episode sebelumnya untuk continuity',
      });
    }
  }

  return violations;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  enableLLMJudge?: boolean;
  judgingCriteria?: JudgingCriteria;
  strictMode?: boolean;
}

// ============================================================
// VF-5.2 — Canon check final sebelum export (video jadi)
// Extend (bukan rewrite) — method baru untuk cek video final,
// bukan cuma naskah. Reuse validateVideoScript() (VF-2.4) untuk
// script, lalu tambah check shot descriptions & metadata video.
// ============================================================

/**
 * Konteks untuk canon check video final (VF-5.2).
 * Extend VideoCanonContext (VF-2.4) dengan field video jadi:
 * shot descriptions, metadata render, dll.
 */
export interface VideoFinalCanonContext extends VideoCanonContext {
  /** ShotSpec[] final dari storyboard — untuk cek visual prompt konsisten persona */
  shotDescriptions?: string[];

  /** Visual prompts per shot — untuk cek konsistensi persona di level visual */
  visualPrompts?: string[];

  /** Metadata video final (judul, durasi, dll) — opsional */
  videoMetadata?: {
    title?: string;
    duration?: number;
    renderStatus?: string;
  };
}

/**
 * Validate video final against canon — cek video jadi (bukan cuma naskah).
 *
 * Ini adalah canon check final sebelum export (VF-5.2):
 * 1. Reuse validateVideoScript() (VF-2.4) untuk cek script final
 * 2. Tambah check shot descriptions/visual prompts konsisten persona
 * 3. Tambah check series continuity di level video jadi
 *
 * Acceptance criteria: "Video yang melanggar persona karakter atau
 * continuity series juga ter-flag, terpisah dari hasil content moderation"
 *
 * @param script Script final video
 * @param context Konteks video final (extend VideoCanonContext)
 * @param options Opsi validasi
 * @returns Hasil canon validation
 */
async function validateVideoFinal(
  this: CanonValidator,
  script: string,
  context: VideoFinalCanonContext,
  options: ValidationOptions = {}
): Promise<CanonValidationResult> {
  const allViolations: ValidationViolation[] = [];
  const errors: CanonValidationResult['errors'] = [];
  const warnings: CanonValidationResult['warnings'] = [];
  const infos: CanonValidationResult['infos'] = [];

  // 1. Reuse validateVideoScript() (VF-2.4) untuk cek script final
  const scriptResult = await this.validateVideoScript(script, context, options);
  allViolations.push(...scriptResult.violations);

  // 2. Check shot descriptions/visual prompts konsisten persona
  if (context.shotDescriptions && context.shotDescriptions.length > 0) {
    const shotViolations = checkShotDescriptionConsistency(context);
    allViolations.push(...shotViolations);
  }

  // 3. Check visual prompts konsisten persona (jika ada)
  if (context.visualPrompts && context.visualPrompts.length > 0) {
    const visualViolations = checkVisualPromptConsistency(context);
    allViolations.push(...visualViolations);
  }

  // 4. Categorize violations
  for (const violation of allViolations) {
    const categorized = {
      path: violation.location,
      message: `${violation.rule}: Expected ${JSON.stringify(violation.expected)}, got ${JSON.stringify(violation.actual)}`,
      code: violation.rule,
    };
    switch (violation.severity) {
      case 'error': errors.push(categorized); break;
      case 'warning': warnings.push(categorized); break;
      case 'info': infos.push(categorized); break;
    }
  }

  const consistencyScore = calculateConsistencyScoreFromViolations(allViolations);

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
 * Helper: hitung consistency score dari violations (standalone, tidak akses private method).
 * Mirror logika CanonValidator.calculateConsistencyScore() tanpa judgeResult.
 */
function calculateConsistencyScoreFromViolations(violations: ValidationViolation[]): number {
  if (violations.length === 0) return 1.0;
  let score = 1.0;
  for (const v of violations) {
    switch (v.severity) {
      case 'error': score -= 0.15; break;
      case 'warning': score -= 0.05; break;
      case 'info': score -= 0.01; break;
    }
  }
  return Math.max(0, Math.min(1, score));
}

/**
 * Check shot descriptions konsisten dengan persona karakter.
 * Cek apakah shot descriptions mengandung kontradiksi dengan core traits/weakness.
 */
function checkShotDescriptionConsistency(context: VideoFinalCanonContext): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const char = context.character;

  if (!context.shotDescriptions) return violations;

  // Cek kontradiksi weakness di shot descriptions
  if (char.coreWeakness) {
    const weaknessLower = char.coreWeakness.toLowerCase();
    const weaknessKeywords = weaknessLower.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);

    const contradictionPatterns: Record<string, string[]> = {
      'takut': ['sangat pemberani', 'tidak takut sama sekali', 'tanpa rasa takut', 'berani sekali'],
      'penakut': ['sangat pemberani', 'tidak takut sama sekali', 'tanpa rasa takut', 'berani sekali'],
      'lemah': ['sangat kuat', 'paling kuat', 'kekuatan luar biasa'],
      'pemalu': ['sangat percaya diri', 'tanpa rasa malu', 'berani tampil'],
    };

    for (const keyword of weaknessKeywords) {
      const patterns = contradictionPatterns[keyword];
      if (patterns) {
        for (const desc of context.shotDescriptions) {
          const descLower = desc.toLowerCase();
          for (const pattern of patterns) {
            if (descLower.includes(pattern.toLowerCase())) {
              violations.push({
                rule: 'video-final-shot-weakness-contradiction',
                severity: 'error',
                location: `shot: "${desc.substring(0, 50)}..."`,
                expected: `shot description konsisten dengan kelemahan "${char.coreWeakness}"`,
                actual: `shot menggambarkan karakter sebagai "${pattern}" yang kontradiksi dengan kelemahan utama`,
                suggestion: `Perbaiki shot description agar konsisten dengan kelemahan "${char.coreWeakness}"`,
              });
            }
          }
        }
      }
    }
  }

  // Cek kontradiksi core traits di shot descriptions
  for (const trait of char.coreTraits) {
    const traitLower = trait.toLowerCase();
    const traitContradictions: Record<string, string[]> = {
      'pemberani': ['penakut sekali', 'tidak berani sama sekali', 'lari ketakutan'],
      'ingin tahu': ['tidak peduli sama sekali', 'acuh tak acuh'],
      'setia kawan': ['mengkhianati teman', 'meninggalkan teman'],
      'jujur': ['berbohong', 'berdusta', 'menipu'],
    };

    const patterns = traitContradictions[traitLower];
    if (patterns) {
      for (const desc of context.shotDescriptions) {
        const descLower = desc.toLowerCase();
        for (const pattern of patterns) {
          if (descLower.includes(pattern.toLowerCase())) {
            violations.push({
              rule: 'video-final-shot-trait-contradiction',
              severity: 'error',
              location: `shot: "${desc.substring(0, 50)}..."`,
              expected: `shot description konsisten dengan sifat "${trait}"`,
              actual: `shot menggambarkan karakter dengan "${pattern}" yang kontradiksi dengan sifat inti "${trait}"`,
              suggestion: `Perbaiki shot description agar konsisten dengan sifat "${trait}"`,
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Check visual prompts konsisten dengan persona karakter.
 * Cek apakah visual prompts mengandung kontradiksi dengan visual description.
 */
function checkVisualPromptConsistency(context: VideoFinalCanonContext): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const char = context.character;

  if (!context.visualPrompts || !char.metadata.visualDescription) return violations;

  const visualDescLower = char.metadata.visualDescription.toLowerCase();

  // Cek apakah visual prompts menyebutkan karakter yang tidak konsisten
  // dengan visual description (mis. visual description menyebut "anak hiu"
  // tapi visual prompt menyebut "anak kucing")
  const speciesKeywords = visualDescLower.match(/\b(anak\s+\w+|karakter\s+\w+)\b/g);
  if (speciesKeywords) {
    for (const prompt of context.visualPrompts) {
      const promptLower = prompt.toLowerCase();
      for (const keyword of speciesKeywords) {
        // Kalau visual prompt menyebut spesies berbeda dari visual description
        const otherSpecies = ['anak kucing', 'anak hiu', 'anak anjing', 'anak kelinci']
          .filter(s => s !== keyword && promptLower.includes(s));
        if (otherSpecies.length > 0) {
          violations.push({
            rule: 'video-final-visual-species-mismatch',
            severity: 'warning',
            location: `visual prompt: "${prompt.substring(0, 50)}..."`,
            expected: `visual prompt konsisten dengan visual description (${keyword})`,
            actual: `visual prompt menyebutkan ${otherSpecies.join(', ')} yang tidak cocok`,
            suggestion: `Pastikan visual prompt menggunakan spesies yang konsisten dengan visual description karakter`,
          });
        }
      }
    }
  }

  return violations;
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
