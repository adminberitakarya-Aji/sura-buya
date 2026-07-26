import { describe, it, expect } from 'vitest';
import { parseBibleFile, stringifyBibleContent } from './BibleEditor';

describe('parseBibleFile', () => {
  it('parses frontmatter and content separately', () => {
    const raw = '---\ntitle: Suro\narchetype: protagonist\n---\n\n# Voice Guide\n\nBerani dan penasaran.';
    const { frontmatter, content } = parseBibleFile(raw);

    expect(frontmatter).toEqual({ title: 'Suro', archetype: 'protagonist' });
    expect(content.trim()).toBe('# Voice Guide\n\nBerani dan penasaran.');
  });

  it('returns empty frontmatter when there is no frontmatter block', () => {
    const raw = '# Just content\n\nNo frontmatter here.';
    const { frontmatter, content } = parseBibleFile(raw);

    expect(frontmatter).toEqual({});
    expect(content).toBe(raw);
  });

  it('falls back gracefully on malformed YAML instead of throwing', () => {
    const raw = '---\ntitle: [unclosed\n---\n\nContent';
    expect(() => parseBibleFile(raw)).not.toThrow();
  });
});

describe('stringifyBibleContent', () => {
  it('returns content as-is when frontmatter is empty', () => {
    const result = stringifyBibleContent({}, '# Hello');
    expect(result).toBe('# Hello');
  });

  it('prepends a YAML frontmatter block when frontmatter has keys', () => {
    const result = stringifyBibleContent({ title: 'Suro' }, '# Hello');
    expect(result).toContain('title: Suro');
    expect(result).toContain('# Hello');
    expect(result.startsWith('---')).toBe(true);
  });

  it('round-trips through parse -> stringify -> parse without losing data', () => {
    const original = '---\ntitle: Buya\ntags:\n  - hiu\n  - buaya\n---\n\nKonten asli.';
    const parsed = parseBibleFile(original);
    const restringified = stringifyBibleContent(parsed.frontmatter, parsed.content);
    const reparsed = parseBibleFile(restringified);

    expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
    expect(reparsed.content.trim()).toBe(parsed.content.trim());
  });
});
