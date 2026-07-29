import { describe, it, expect } from 'vitest';
import {
  parseSceneOutput,
  formatSceneOutput,
  sceneOutputToBlocks,
  blocksToText,
  type SceneBlock,
} from './scene-output';
import type { SceneOutput } from '@suro-buya/engine-v2/generate/orchestrator.js';

const sampleOutput: SceneOutput = {
  sceneHeading: 'INT. RUMAH SURO - PAGI',
  actionLines: ['Suro bangun dan meregangkan tubuhnya.', 'Buya mengetuk pintu.'],
  dialogue: [
    { character: 'SURO', line: 'Buya! Kamu datang pagi sekali.' },
    { character: 'BUYA', line: 'Ada yang harus kita lihat.', parenthetical: 'bersemangat' },
  ],
  transitions: ['CUT TO:'],
  metadata: {
    estimatedDuration: 120,
    characters: ['suro', 'buya'],
    location: 'rumah-suro',
    timeOfDay: 'pagi',
    sceneType: 'dialogue',
  },
};

describe('parseSceneOutput', () => {
  it('parses valid structured JSON embedded in surrounding text', () => {
    const raw = `Here is the scene:\n${JSON.stringify(sampleOutput)}\nEnd.`;
    const parsed = parseSceneOutput(raw);
    expect(parsed).toBeDefined();
    expect(parsed?.sceneHeading).toBe(sampleOutput.sceneHeading);
    expect(parsed?.dialogue).toHaveLength(2);
  });

  it('returns undefined for plain prose with no JSON', () => {
    expect(parseSceneOutput('Just a plain generated paragraph, no JSON here.')).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    expect(parseSceneOutput('{ "sceneHeading": "INT. X" invalid')).toBeUndefined();
  });

  it('returns undefined when JSON is valid but fails schema validation', () => {
    const invalid = JSON.stringify({ sceneHeading: 'INT. X' }); // missing required fields
    expect(parseSceneOutput(invalid)).toBeUndefined();
  });
});

describe('sceneOutputToBlocks', () => {
  it('produces one heading block first', () => {
    const blocks = sceneOutputToBlocks(sampleOutput);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0]).toMatchObject({ text: sampleOutput.sceneHeading });
  });

  it('produces an action block per action line, in order', () => {
    const blocks = sceneOutputToBlocks(sampleOutput);
    const actionBlocks = blocks.filter((b) => b.type === 'action');
    expect(actionBlocks.map((b) => (b as { text: string }).text)).toEqual(sampleOutput.actionLines);
  });

  it('produces a dialogue block per line, preserving character/parenthetical', () => {
    const blocks = sceneOutputToBlocks(sampleOutput);
    const dialogueBlocks = blocks.filter((b) => b.type === 'dialogue') as Extract<
      SceneBlock,
      { type: 'dialogue' }
    >[];
    expect(dialogueBlocks).toHaveLength(2);
    expect(dialogueBlocks[0].character).toBe('SURO');
    expect(dialogueBlocks[1].parenthetical).toBe('bersemangat');
  });

  it('produces a transition block for each transition', () => {
    const blocks = sceneOutputToBlocks(sampleOutput);
    const transitions = blocks.filter((b) => b.type === 'transition');
    expect(transitions).toHaveLength(1);
  });

  it('assigns every block a unique id', () => {
    const blocks = sceneOutputToBlocks(sampleOutput);
    const ids = new Set(blocks.map((b) => b.id));
    expect(ids.size).toBe(blocks.length);
  });

  it('handles missing optional transitions gracefully', () => {
    const { transitions, ...rest } = sampleOutput;
    const blocks = sceneOutputToBlocks(rest as SceneOutput);
    expect(blocks.some((b) => b.type === 'transition')).toBe(false);
  });
});

describe('blocksToText', () => {
  it('renders heading, action, dialogue, and transition blocks in order', () => {
    const blocks: SceneBlock[] = [
      { id: '1', type: 'heading', text: 'INT. RUMAH - PAGI' },
      { id: '2', type: 'action', text: 'Suro berjalan masuk.' },
      { id: '3', type: 'dialogue', character: 'SURO', line: 'Halo!' },
      { id: '4', type: 'transition', text: 'CUT TO:' },
    ];
    const text = blocksToText(blocks);
    expect(text).toContain('INT. RUMAH - PAGI');
    expect(text).toContain('Suro berjalan masuk.');
    expect(text).toContain('SURO');
    expect(text).toContain('Halo!');
    expect(text).toContain('CUT TO:');
    // Heading should come before the action line, which comes before dialogue.
    expect(text.indexOf('INT. RUMAH')).toBeLessThan(text.indexOf('berjalan masuk'));
    expect(text.indexOf('berjalan masuk')).toBeLessThan(text.indexOf('Halo!'));
  });

  it('includes the parenthetical on its own line when present', () => {
    const blocks: SceneBlock[] = [
      { id: '1', type: 'dialogue', character: 'BUYA', line: 'Tunggu!', parenthetical: 'berteriak' },
    ];
    const text = blocksToText(blocks);
    expect(text).toContain('(berteriak)');
  });

  it('omits the parenthetical line when absent', () => {
    const blocks: SceneBlock[] = [{ id: '1', type: 'dialogue', character: 'BUYA', line: 'Tunggu!' }];
    const text = blocksToText(blocks);
    expect(text).not.toContain('(');
  });

  it('round-trips through sceneOutputToBlocks -> blocksToText -> formatSceneOutput consistently', () => {
    const viaBlocks = blocksToText(sceneOutputToBlocks(sampleOutput));
    const viaFormat = formatSceneOutput(sampleOutput);
    expect(viaBlocks).toBe(viaFormat);
  });
});

describe('formatSceneOutput', () => {
  it('produces non-empty readable text containing all dialogue lines', () => {
    const text = formatSceneOutput(sampleOutput);
    for (const line of sampleOutput.dialogue) {
      expect(text).toContain(line.line);
    }
  });
});
