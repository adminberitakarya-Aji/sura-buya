/**
 * Suro-Buya Engine v2 - Comparison Merge Utilities
 * 
 * Utilities for merging and combining outputs from multiple models
 */

import type {
  ComparisonResult,
  MergeComparisonInput,
  MergeComparisonResult,
  MergeStrategy,
} from './types.js';

/**
 * Merge multiple comparison results using specified strategy
 */
export async function mergeComparisonResults(
  input: MergeComparisonInput,
  results: ComparisonResult[]
): Promise<MergeComparisonResult> {
  const { strategy, manualSelection, targetSceneId } = input;
  
  switch (strategy) {
    case 'winner-only':
      return mergeWinnerOnly(results);
    case 'manual':
      if (!manualSelection) {
        throw new Error('Manual selection required for manual merge strategy');
      }
      return mergeManual(results, manualSelection);
    case 'auto-best-segments':
      return mergeAutoBestSegments(results);
    default:
      throw new Error(`Unknown merge strategy: ${strategy}`);
  }
}

/**
 * Use only the winner's output (rank 1)
 */
function mergeWinnerOnly(results: ComparisonResult[]): MergeComparisonResult {
  const winner = results.find(r => r.rank === 1 && !r.error);
  
  if (!winner) {
    throw new Error('No winner found for winner-only merge');
  }
  
  const { modelId, modelName, output } = winner;
  
  return {
    mergedOutput: output,
    sources: [{
      resultId: modelId,
      modelName: modelName,
      segments: [{ start: 0, end: output.length }],
    }],
  };
}

/**
 * Manual merge based on user selection
 */
function mergeManual(
  results: ComparisonResult[],
  selection: MergeComparisonInput['manualSelection']
): MergeComparisonResult {
  if (!selection) {
    throw new Error('Manual selection is required');
  }
  
  const { resultId: baseResultId, segments } = selection;
  const baseResult = results.find(r => r.modelId === baseResultId);
  
  if (!baseResult) {
    throw new Error(`Base result not found: ${baseResultId}`);
  }
  
  // Build merged output from segments
  let mergedOutput = '';
  const sources: MergeComparisonResult['sources'] = [];
  
  for (const segment of segments) {
    const sourceResult = results.find(r => r.modelId === segment.sourceResultId);
    if (!sourceResult) {
      throw new Error(`Source result not found: ${segment.sourceResultId}`);
    }
    
    const { modelId, modelName, output } = sourceResult;
    const segmentText = output.slice(segment.start, segment.end);
    mergedOutput += segmentText;
    
    // Track source
    const existingSource = sources.find(s => s.resultId === modelId);
    if (existingSource) {
      existingSource.segments.push({ start: segment.start, end: segment.end });
    } else {
      sources.push({
        resultId: modelId,
        modelName: modelName,
        segments: [{ start: segment.start, end: segment.end }],
      });
    }
  }
  
  return { mergedOutput, sources };
}

/**
 * Automatically pick best segments from each result
 * This is a simplified version - in production would use semantic similarity
 */
function mergeAutoBestSegments(results: ComparisonResult[]): MergeComparisonResult {
  const successful = results.filter(r => !r.error && r.output).sort((a, b) => (b.rank || 99) - (a.rank || 99));
  
  if (successful.length === 0) {
    throw new Error('No successful results to merge');
  }
  
  if (successful.length === 1) {
    const r = successful[0];
    if (!r) throw new Error('No result found');
    return {
      mergedOutput: r.output,
      sources: [{
        resultId: r.modelId,
        modelName: r.modelName,
        segments: [{ start: 0, end: r.output.length }],
      }],
    };
  }
  
  // Simple heuristic: split by paragraphs and pick best from each
  // In production, use embedding-based semantic matching
  const firstOutput = successful[0]?.output || '';
  const paragraphs = splitIntoParagraphs(firstOutput);
  let mergedOutput = '';
  const sources: MergeComparisonResult['sources'] = [];
  
  for (const paragraph of paragraphs) {
    // Find result with best quality score for this paragraph type
    const bestResult = successful.reduce((best, current) => {
      const bestScore = best?.scores?.quality || 0;
      const currentScore = current?.scores?.quality || 0;
      return currentScore > bestScore ? current : best;
    }, successful[0]);
    
    if (!bestResult) continue;
    
    // Find this paragraph in the best result
    const idx = bestResult.output.indexOf(paragraph);
    if (idx >= 0) {
      const segmentText = bestResult.output.slice(idx, idx + paragraph.length);
      mergedOutput += segmentText + '\n\n';
      
      const existingSource = sources.find(s => s.resultId === bestResult.modelId);
      if (existingSource) {
        existingSource.segments.push({ start: idx, end: idx + paragraph.length });
      } else {
        sources.push({
          resultId: bestResult.modelId,
          modelName: bestResult.modelName,
          segments: [{ start: idx, end: idx + paragraph.length }],
        });
      }
    }
  }
  
  return { mergedOutput: mergedOutput.trim(), sources };
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Create a diff between two outputs for visualization
 */
export function createDiff(
  baseOutput: string,
  compareOutput: string
): Array<{ type: 'equal' | 'insert' | 'delete'; text: string }> {
  // Simple line-based diff
  const baseLines = baseOutput.split('\n');
  const compareLines = compareOutput.split('\n');
  const result: Array<{ type: 'equal' | 'insert' | 'delete'; text: string }> = [];
  
  let i = 0, j = 0;
  while (i < baseLines.length || j < compareLines.length) {
    const baseLine = baseLines[i];
    const compareLine = compareLines[j];
    
    if (baseLine !== undefined && compareLine !== undefined && baseLine === compareLine) {
      result.push({ type: 'equal', text: baseLine + '\n' });
      i++; j++;
    } else if (compareLine !== undefined && (i >= baseLines.length || !baseLines.slice(i).includes(compareLine))) {
      result.push({ type: 'insert', text: compareLine + '\n' });
      j++;
    } else if (baseLine !== undefined) {
      result.push({ type: 'delete', text: baseLine + '\n' });
      i++;
    } else {
      // Both undefined or exhausted
      break;
    }
  }
  
  return result;
}

/**
 * Find common segments between outputs
 */
export function findCommonSegments(
  outputs: string[],
  minLength: number = 50
): Array<{ text: string; indices: number[] }> {
  if (outputs.length < 2) return [];
  
  const common: Array<{ text: string; indices: number[] }> = [];
  const base = outputs[0];
  
  if (!base) return [];
  
  // Find common substrings (simplified)
  for (let i = 0; i < base.length - minLength; i++) {
    for (let len = minLength; len <= Math.min(200, base.length - i); len += 10) {
      const substr = base.slice(i, i + len);
      const indices = [0];
      
      for (let k = 1; k < outputs.length; k++) {
        const output = outputs[k];
        if (!output) {
          indices.push(-1);
          continue;
        }
        const idx = output.indexOf(substr);
        if (idx >= 0) {
          indices.push(idx);
        } else {
          indices.push(-1);
        }
      }
      
      if (indices.every(idx => idx >= 0)) {
        common.push({ text: substr, indices });
      }
    }
  }
  
  // Deduplicate and sort by length
  return common
    .filter((v, i, arr) => arr.findIndex(x => x.text === v.text) === i)
    .sort((a, b) => b.text.length - a.text.length);
}

/**
 * Highlight differences between outputs for UI
 */
export function highlightDifferences(
  results: ComparisonResult[],
  baseModelId?: string
): ComparisonResult[] {
  const base = baseModelId 
    ? results.find(r => r.modelId === baseModelId)
    : results.find(r => r.rank === 1);
  
  if (!base) return results;
  
  const baseOutput = base.output;
  const baseModelIdResolved = base.modelId;
  
  return results.map(result => {
    if (result.modelId === baseModelIdResolved) {
      return { ...result, output: result.output }; // No highlighting for base
    }
    
    const diff = createDiff(baseOutput, result.output);
    // Add markup for UI highlighting
    const highlighted = diff.map(d => {
      if (d.type === 'insert') return `<ins class="diff-insert">${escapeHtml(d.text)}</ins>`;
      if (d.type === 'delete') return `<del class="diff-delete">${escapeHtml(d.text)}</del>`;
      return escapeHtml(d.text);
    }).join('');
    
    return { ...result, output: highlighted };
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Export comparison results to various formats
 */
export function exportComparisonResults(
  results: ComparisonResult[],
  format: 'json' | 'markdown' | 'csv' = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'markdown':
      return exportToMarkdown(results);
    case 'csv':
      return exportToCSV(results);
    default:
      return JSON.stringify(results, null, 2);
  }
}

function exportToMarkdown(results: ComparisonResult[]): string {
  let md = '# Comparison Results\n\n';
  
  for (const result of results) {
    md += `## ${result.modelName} (${result.provider})\n\n`;
    md += `**Rank:** ${result.rank || 'N/A'}  \n`;
    md += `**Overall Score:** ${result.scores.overall}/100  \n`;
    md += `**Tokens:** ${result.tokensUsed.total}  \n`;
    md += `**Latency:** ${result.latencyMs}ms  \n`;
    md += `**Cost:** $${result.costEstimate.toFixed(4)}  \n\n`;
    md += `### Scores\n\n`;
    md += `| Dimension | Score |\n|-----------|-------|\n`;
    md += `| Canon | ${result.scores.canon} |\n`;
    md += `| Quality | ${result.scores.quality} |\n`;
    md += `| Creativity | ${result.scores.creativity} |\n`;
    md += `| Instruction | ${result.scores.instruction} |\n\n`;
    md += `### Output\n\n\`\`\`\n${result.output}\n\`\`\`\n\n`;
    
    if (result.error) {
      md += `**Error:** ${result.error}\n\n`;
    }
    
    md += '---\n\n';
  }
  
  return md;
}

function exportToCSV(results: ComparisonResult[]): string {
  const headers = [
    'Model ID',
    'Model Name',
    'Provider',
    'Rank',
    'Overall Score',
    'Canon',
    'Quality',
    'Creativity',
    'Instruction',
    'Tokens Used',
    'Latency (ms)',
    'Cost (USD)',
    'Error',
  ];
  
  const rows = results.map(r => [
    r.modelId,
    r.modelName,
    r.provider,
    r.rank?.toString() || '',
    r.scores.overall.toString(),
    r.scores.canon.toString(),
    r.scores.quality.toString(),
    r.scores.creativity.toString(),
    r.scores.instruction.toString(),
    r.tokensUsed.total.toString(),
    r.latencyMs.toString(),
    r.costEstimate.toFixed(4),
    r.error || '',
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}