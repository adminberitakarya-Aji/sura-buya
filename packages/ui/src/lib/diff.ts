export type DiffOp = { type: 'equal' | 'add' | 'remove'; value: string };

/**
 * Word-level diff via a straightforward LCS dynamic program. Fine for
 * scene-length text (a few hundred words); not meant for huge documents.
 * Splits on whitespace but keeps the whitespace as part of each token so
 * the reconstructed text renders naturally.
 */
export function diffWords(oldText: string, newText: string): DiffOp[] {
  const a = oldText.match(/\S+\s*|\s+/g) ?? [];
  const b = newText.match(/\S+\s*|\s+/g) ?? [];

  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', value: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'remove', value: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', value: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'remove', value: a[i++] });
  while (j < m) ops.push({ type: 'add', value: b[j++] });

  // Merge adjacent ops of the same type for cleaner rendering.
  const merged: DiffOp[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.value += op.value;
    } else {
      merged.push({ ...op });
    }
  }

  return merged;
}
