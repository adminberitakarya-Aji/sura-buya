import {
  RuleEngine,
  CanonValidator,
  createDefaultRuleEngine,
  createDefaultLLMJudge,
  DEFAULT_JUDGING_CRITERIA,
  type CanonRule as EngineCanonRule,
  type JudgingCriteria,
} from '@suro-buya/engine-v2/validate/canon.js';
import type { ValidationViolation } from '@suro-buya/engine-v2';
import type { CanonRule as DbCanonRule } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildProviderRegistryForUniverse } from './orchestrator';

/**
 * DB CanonRule -> engine-v2 CanonRule adapter
 * ============================================
 * The dashboard stores canon rules as data (ruleType + regex pattern +
 * severity) in Postgres so non-developers can manage them. engine-v2's
 * RuleEngine expects live `check(context) => violations` functions instead,
 * so this turns each DB row into the equivalent rule-engine callback.
 *
 * CUSTOM_LLM rules aren't pattern-matchable — those are handled separately
 * as extra JudgingCriteria fed to the LLM judge (see buildJudgingCriteria).
 */
function dbRuleToEngineRule(rule: DbCanonRule): EngineCanonRule | null {
  const severity = rule.severity.toLowerCase() as 'error' | 'warning' | 'info';

  function safeRegex(pattern: string, flags: string): RegExp | null {
    try {
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }

  switch (rule.ruleType) {
    case 'BANNED_WORD':
      return {
        id: rule.ruleId,
        name: rule.name,
        description: rule.description,
        severity,
        check: (context) => {
          if (!rule.pattern) return [];
          const regex = safeRegex(rule.pattern, 'gi');
          const match = regex?.exec(context.content ?? '');
          if (!match) return [];
          return [
            {
              rule: rule.ruleId,
              severity,
              location: 'scene.content',
              expected: `tidak mengandung pola terlarang: ${rule.pattern}`,
              actual: `ditemukan: "${match[0]}"`,
              suggestion: rule.description,
            },
          ];
        },
      };

    case 'REQUIRED_ELEMENT':
      return {
        id: rule.ruleId,
        name: rule.name,
        description: rule.description,
        severity,
        check: (context) => {
          if (!rule.pattern) return [];
          const regex = safeRegex(rule.pattern, 'i');
          if (!regex || regex.test(context.content ?? '')) return [];
          return [
            {
              rule: rule.ruleId,
              severity,
              location: 'scene.content',
              expected: `mengandung elemen wajib: ${rule.pattern}`,
              actual: 'tidak ditemukan di scene',
              suggestion: rule.description,
            },
          ];
        },
      };

    case 'STRUCTURE':
      return {
        id: rule.ruleId,
        name: rule.name,
        description: rule.description,
        severity,
        check: (context) => {
          if (!rule.pattern) return [];
          const regex = safeRegex(rule.pattern, 'm');
          if (!regex || regex.test(context.content ?? '')) return [];
          return [
            {
              rule: rule.ruleId,
              severity,
              location: 'scene.structure',
              expected: `struktur sesuai pola: ${rule.pattern}`,
              actual: 'struktur scene tidak sesuai pola yang diharapkan',
              suggestion: rule.description,
            },
          ];
        },
      };

    case 'CHARACTER_CONSISTENCY':
      return {
        id: rule.ruleId,
        name: rule.name,
        description: rule.description,
        severity,
        check: (context) => {
          const violations: ValidationViolation[] = [];
          if (context.characterBibles && context.sceneData) {
            for (const charId of context.sceneData.characters) {
              if (!context.characterBibles[charId]) {
                violations.push({
                  rule: rule.ruleId,
                  severity,
                  location: `scene.characters: ${charId}`,
                  expected: 'karakter terdaftar di character bible universe',
                  actual: `karakter tidak dikenal: ${charId}`,
                  suggestion: rule.description,
                });
              }
            }
          }
          if (rule.pattern) {
            const regex = safeRegex(rule.pattern, 'i');
            if (regex && !regex.test(context.content ?? '')) {
              violations.push({
                rule: rule.ruleId,
                severity,
                location: 'scene.content',
                expected: `pola konsistensi karakter: ${rule.pattern}`,
                actual: 'tidak ditemukan di scene',
                suggestion: rule.description,
              });
            }
          }
          return violations;
        },
      };

    case 'CUSTOM_LLM':
    default:
      // Handled as a JudgingCriterion instead — see buildJudgingCriteria.
      return null;
  }
}

/** Merge the engine's default judging criteria with any CUSTOM_LLM DB rules. */
export function buildJudgingCriteria(dbRules: DbCanonRule[]): JudgingCriteria {
  const customCriteria = dbRules
    .filter((r) => r.ruleType === 'CUSTOM_LLM' && r.isActive)
    .map((r) => ({ name: r.ruleId, description: r.description, weight: 0.15 }));

  return [...DEFAULT_JUDGING_CRITERIA, ...customCriteria];
}

export interface UniverseValidator {
  validator: CanonValidator;
  dbRules: DbCanonRule[];
}

/**
 * Build a CanonValidator for a universe: engine defaults + this universe's
 * active DB-defined canon rules, plus an LLM judge if a 'validation'-task
 * provider is configured (falls back to rule-engine-only if not).
 */
export async function buildCanonValidatorForUniverse(
  universeId: string
): Promise<UniverseValidator> {
  const [dbRules, registry] = await Promise.all([
    prisma.canonRule.findMany({ where: { universeId, isActive: true } }),
    buildProviderRegistryForUniverse(universeId).catch(() => null),
  ]);

  const ruleEngine: RuleEngine = createDefaultRuleEngine();
  for (const dbRule of dbRules) {
    const engineRule = dbRuleToEngineRule(dbRule);
    if (engineRule) ruleEngine.addRule(engineRule);
  }

  const llmJudge = registry ? await createDefaultLLMJudge(registry) : null;
  const validator = new CanonValidator(ruleEngine, llmJudge ?? undefined);

  return { validator, dbRules };
}
