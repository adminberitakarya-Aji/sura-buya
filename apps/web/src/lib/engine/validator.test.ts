import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { dbRuleToEngineRule, buildJudgingCriteria } from './validator';
import type { ValidationContext } from '@suro-buya/engine-v2';
import type { CanonRule as DbCanonRule } from '@prisma/client';

function makeDbRule(overrides: Partial<DbCanonRule>): DbCanonRule {
  return {
    id: 'db-1',
    universeId: 'uni-1',
    ruleId: 'test-rule',
    name: 'Test Rule',
    description: 'A rule used in tests.',
    ruleType: 'BANNED_WORD',
    pattern: null,
    severity: 'WARNING',
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DbCanonRule;
}

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    content: '',
    contentType: 'scene',
    ...overrides,
  } as ValidationContext;
}

describe('dbRuleToEngineRule', () => {
  it('returns null for CUSTOM_LLM rules (handled via JudgingCriteria instead)', () => {
    const rule = makeDbRule({ ruleType: 'CUSTOM_LLM' });
    expect(dbRuleToEngineRule(rule)).toBeNull();
  });

  describe('BANNED_WORD', () => {
    it('flags content containing the banned pattern', () => {
      const rule = makeDbRule({ ruleType: 'BANNED_WORD', pattern: 'kekerasan', severity: 'ERROR' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(makeContext({ content: 'Ada adegan kekerasan di sini.' }));
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('error');
      expect(violations[0].rule).toBe('test-rule');
    });

    it('passes clean content through with no violations', () => {
      const rule = makeDbRule({ ruleType: 'BANNED_WORD', pattern: 'kekerasan' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(makeContext({ content: 'Suro dan Buya bermain di pantai.' }));
      expect(violations).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      const rule = makeDbRule({ ruleType: 'BANNED_WORD', pattern: 'bodoh' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(makeContext({ content: 'Kamu BODOH sekali!' }));
      expect(violations).toHaveLength(1);
    });

    it('does not crash on an invalid regex pattern', () => {
      const rule = makeDbRule({ ruleType: 'BANNED_WORD', pattern: '[unterminated' });
      const engineRule = dbRuleToEngineRule(rule)!;
      expect(() => engineRule.check(makeContext({ content: 'anything' }))).not.toThrow();
      expect(engineRule.check(makeContext({ content: 'anything' }))).toHaveLength(0);
    });

    it('produces no violations when there is no pattern set', () => {
      const rule = makeDbRule({ ruleType: 'BANNED_WORD', pattern: null });
      const engineRule = dbRuleToEngineRule(rule)!;
      expect(engineRule.check(makeContext({ content: 'anything at all' }))).toHaveLength(0);
    });
  });

  describe('REQUIRED_ELEMENT', () => {
    it('flags content missing the required pattern', () => {
      const rule = makeDbRule({ ruleType: 'REQUIRED_ELEMENT', pattern: 'pelajaran' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(makeContext({ content: 'Suro dan Buya berlayar.' }));
      expect(violations).toHaveLength(1);
    });

    it('passes when the required pattern is present', () => {
      const rule = makeDbRule({ ruleType: 'REQUIRED_ELEMENT', pattern: 'pelajaran' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(
        makeContext({ content: 'Mereka belajar pelajaran penting tentang berbagi.' })
      );
      expect(violations).toHaveLength(0);
    });
  });

  describe('STRUCTURE', () => {
    it('flags content that does not match the expected structural pattern', () => {
      const rule = makeDbRule({ ruleType: 'STRUCTURE', pattern: '^INT\\.|^EXT\\.' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(makeContext({ content: 'Suro berjalan ke pantai.' }));
      expect(violations).toHaveLength(1);
    });

    it('passes when the structural pattern matches', () => {
      const rule = makeDbRule({ ruleType: 'STRUCTURE', pattern: '^INT\\.|^EXT\\.' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(
        makeContext({ content: 'EXT. PANTAI - PAGI\nSuro berjalan ke pantai.' })
      );
      expect(violations).toHaveLength(0);
    });
  });

  describe('CHARACTER_CONSISTENCY', () => {
    it('flags a scene character not present in the character bible', () => {
      const rule = makeDbRule({ ruleType: 'CHARACTER_CONSISTENCY', pattern: null });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(
        makeContext({
          content: 'text',
          characterBibles: { suro: { id: 'suro' } } as never,
          sceneData: { characters: ['suro', 'unknown-character'] } as never,
        })
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].location).toContain('unknown-character');
    });

    it('passes when every scene character exists in the character bible', () => {
      const rule = makeDbRule({ ruleType: 'CHARACTER_CONSISTENCY', pattern: null });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(
        makeContext({
          content: 'text',
          characterBibles: { suro: { id: 'suro' }, buya: { id: 'buya' } } as never,
          sceneData: { characters: ['suro', 'buya'] } as never,
        })
      );
      expect(violations).toHaveLength(0);
    });

    it('also enforces an optional content pattern alongside the character check', () => {
      const rule = makeDbRule({ ruleType: 'CHARACTER_CONSISTENCY', pattern: 'sahabat' });
      const engineRule = dbRuleToEngineRule(rule)!;
      const violations = engineRule.check(
        makeContext({
          content: 'Mereka berdua bertengkar terus.',
          characterBibles: { suro: { id: 'suro' } } as never,
          sceneData: { characters: ['suro'] } as never,
        })
      );
      expect(violations).toHaveLength(1);
    });
  });
});

describe('buildJudgingCriteria', () => {
  it('includes the default judging criteria', () => {
    const criteria = buildJudgingCriteria([]);
    expect(criteria.length).toBeGreaterThan(0);
  });

  it('adds one extra criterion per active CUSTOM_LLM rule', () => {
    const rules = [
      makeDbRule({ ruleType: 'CUSTOM_LLM', ruleId: 'tone-check', isActive: true }),
      makeDbRule({ ruleType: 'CUSTOM_LLM', ruleId: 'inactive-check', isActive: false }),
      makeDbRule({ ruleType: 'BANNED_WORD', ruleId: 'not-llm', isActive: true }),
    ];
    const withDefaults = buildJudgingCriteria([]);
    const withCustom = buildJudgingCriteria(rules);
    // Only the one active CUSTOM_LLM rule should add a criterion.
    expect(withCustom.length).toBe(withDefaults.length + 1);
    expect(withCustom.some((c) => c.name === 'tone-check')).toBe(true);
    expect(withCustom.some((c) => c.name === 'inactive-check')).toBe(false);
  });
});
