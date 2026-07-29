import { describe, it, expect } from 'vitest';
import { diffWords } from './diff';

describe('diffWords', () => {
  it('returns a single equal op for identical text', () => {
    const ops = diffWords('halo dunia', 'halo dunia');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: 'equal', value: 'halo dunia' });
  });

  it('detects an added word at the end', () => {
    const ops = diffWords('Suro pergi', 'Suro pergi cepat');
    const types = ops.map((o) => o.type);
    expect(types).toContain('add');
    const addedText = ops
      .filter((o) => o.type === 'add')
      .map((o) => o.value)
      .join('');
    expect(addedText).toContain('cepat');
  });

  it('detects a removed word', () => {
    const ops = diffWords('Suro dan Buya pergi', 'Suro pergi');
    const removed = ops.filter((o) => o.type === 'remove').map((o) => o.value.trim());
    expect(removed.join(' ')).toContain('dan');
    expect(removed.join(' ')).toContain('Buya');
  });

  it('detects a word substitution as remove+add rather than treating the whole string as different', () => {
    const ops = diffWords('Buya merasa senang', 'Buya merasa sedih');
    expect(ops.some((o) => o.type === 'equal' && o.value.includes('Buya'))).toBe(true);
    expect(ops.some((o) => o.type === 'remove' && o.value.includes('senang'))).toBe(true);
    expect(ops.some((o) => o.type === 'add' && o.value.includes('sedih'))).toBe(true);
  });

  it('handles empty strings without throwing', () => {
    expect(() => diffWords('', '')).not.toThrow();
    expect(diffWords('', 'baru').some((o) => o.type === 'add')).toBe(true);
    expect(diffWords('lama', '').some((o) => o.type === 'remove')).toBe(true);
  });

  it('merges adjacent ops of the same type', () => {
    const ops = diffWords('a b c', 'x y z');
    // Every original word removed, every new word added — should collapse
    // into exactly one remove block and one add block, not per-word ops.
    const removeOps = ops.filter((o) => o.type === 'remove');
    const addOps = ops.filter((o) => o.type === 'add');
    expect(removeOps).toHaveLength(1);
    expect(addOps).toHaveLength(1);
  });

  it('reconstructs old text from equal+remove ops', () => {
    const oldText = 'Suro dan Buya berlayar ke pelabuhan';
    const newText = 'Suro berlayar ke pasar';
    const ops = diffWords(oldText, newText);
    const reconstructedOld = ops
      .filter((o) => o.type !== 'add')
      .map((o) => o.value)
      .join('');
    expect(reconstructedOld).toBe(oldText);
  });

  it('reconstructs new text from equal+add ops', () => {
    const oldText = 'Suro dan Buya berlayar ke pelabuhan';
    const newText = 'Suro berlayar ke pasar';
    const ops = diffWords(oldText, newText);
    const reconstructedNew = ops
      .filter((o) => o.type !== 'remove')
      .map((o) => o.value)
      .join('');
    expect(reconstructedNew).toBe(newText);
  });
});
