import { SceneOutputSchema, type SceneOutput } from '@suro-buya/engine-v2/generate/orchestrator.js';

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
  const lines: string[] = [output.sceneHeading];

  for (const action of output.actionLines) {
    lines.push('', action);
  }

  for (const dialogue of output.dialogue) {
    lines.push('', dialogue.character);
    if (dialogue.parenthetical) lines.push(`(${dialogue.parenthetical})`);
    lines.push(dialogue.line);
  }

  for (const transition of output.transitions ?? []) {
    lines.push('', transition);
  }

  return lines.join('\n');
}
