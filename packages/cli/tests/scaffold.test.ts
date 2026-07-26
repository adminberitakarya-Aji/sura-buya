import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { BIBLE_DIRECTORIES, scaffoldUniverse, getAvailableTemplates } from '../src/utils/scaffold.js';

describe('Scaffold Utilities', () => {
  const testDir = path.join(process.cwd(), 'temp-test-universe');

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('should export standard BIBLE_DIRECTORIES list', () => {
    expect(BIBLE_DIRECTORIES).toContain('01-character-bible');
    expect(BIBLE_DIRECTORIES).toContain('02-world-bible');
    expect(BIBLE_DIRECTORIES).toContain('03-story-bible');
    expect(BIBLE_DIRECTORIES).toContain('04-visual-bible');
    expect(BIBLE_DIRECTORIES).toContain('05-production-bible');
  });

  it('should list available templates', async () => {
    const templates = await getAvailableTemplates();
    expect(Array.isArray(templates)).toBe(true);
  });

  it('should scaffold a complete universe directory structure', async () => {
    await scaffoldUniverse(testDir, 'test-universe', 'Test Universe');

    expect(await fs.pathExists(path.join(testDir, 'universe.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(testDir, '.gitignore'))).toBe(true);

    for (const dir of BIBLE_DIRECTORIES) {
      expect(await fs.pathExists(path.join(testDir, 'bible', dir))).toBe(true);
    }

    const manifestContent = await fs.readFile(path.join(testDir, 'universe.yaml'), 'utf-8');
    expect(manifestContent).toContain('id: "test-universe"');
    expect(manifestContent).toContain('name: "Test Universe"');
  });
});
