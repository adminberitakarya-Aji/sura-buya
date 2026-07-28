import { SceneOutputSchema, type SceneOutput } from '@suro-buya/engine-v2/generate/orchestrator.js';

/**
 * Structured block representation of a scene, used by the block-based Scene
 * Editor. `Scene.generatedText` (flattened screenplay text) is always kept
 * in sync with `Scene.blocks` so validation/diff/review keep working
 * unchanged regardless of which representation was last edited.
 */
export type SceneBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'action'; text: string }
  | { id: string; type: 'dialogue'; character: string; line: string; parenthetical?: string }
  | { id: string; type: 'transition'; text: string };

function blockId(type: string, index: number): string {
  return `${type}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Convert the orchestrator's structured output into editable blocks. */
export function sceneOutputToBlocks(output: SceneOutput): SceneBlock[] {
  const blocks: SceneBlock[] = [{ id: blockId('heading', 0), type: 'heading', text: output.sceneHeading }];

  output.actionLines.forEach((text, i) => {
    blocks.push({ id: blockId('action', i), type: 'action', text });
  });

  output.dialogue.forEach((d, i) => {
    blocks.push({
      id: blockId('dialogue', i),
      type: 'dialogue',
      character: d.character,
      line: d.line,
      parenthetical: d.parenthetical,
    });
  });

  (output.transitions ?? []).forEach((text, i) => {
    blocks.push({ id: blockId('transition', i), type: 'transition', text });
  });

  return blocks;
}

/** Flatten blocks back into the same screenplay-text shape as formatSceneOutput. */
export function blocksToText(blocks: SceneBlock[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    if (lines.length > 0) lines.push('');
    if (block.type === 'heading') lines.push(block.text);
    else if (block.type === 'action') lines.push(block.text);
    else if (block.type === 'transition') lines.push(block.text);
    else {
      lines.push(block.character);
      if (block.parenthetical) lines.push(`(${block.parenthetical})`);
      lines.push(block.line);
    }
  }

  return lines.join('\n');
}

/**
 * Attempt to extract and validate structured scene JSON from a raw LLM
 * response. Mirrors `GenerationOrchestrator`'s private `parseStructuredOutput`
 * (which isn't exported), so the dashboard can independently re-parse the
 * accumulated stream content once generation finishes.
 */
export function parseSceneOutput(content: string): SceneOutput | undefined {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return undefined;
    const parsed = JSON.parse(jsonMatch[0]);
    return SceneOutputSchema.parse(parsed);
  } catch {
    return undefined;
  }
}

/** Format structured scene output as readable screenplay text. */
export function formatSceneOutput(output: SceneOutput): string {
  return blocksToText(sceneOutputToBlocks(output));
}
