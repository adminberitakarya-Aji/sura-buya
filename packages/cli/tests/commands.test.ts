import { describe, it, expect } from 'vitest';
import {
  createUniverseCommand,
  generateSceneCommand,
  generateEpisodeCommand,
  generateSeasonCommand,
  validateUniverseCommand,
} from '../src/index.js';

describe('CLI Commands Export & Definition', () => {
  it('should define createUniverseCommand properly', () => {
    expect(createUniverseCommand.name).toBe('create-universe');
    expect(createUniverseCommand.usage).toBeDefined();
    expect(createUniverseCommand.aliases).toContain('cu');
    expect(typeof createUniverseCommand.handler).toBe('function');
  });

  it('should define generateSceneCommand properly', () => {
    expect(generateSceneCommand.name).toBe('generate:scene');
    expect(generateSceneCommand.aliases).toContain('gs');
    expect(typeof generateSceneCommand.handler).toBe('function');
  });

  it('should define generateEpisodeCommand properly', () => {
    expect(generateEpisodeCommand.name).toBe('generate:episode');
    expect(generateEpisodeCommand.aliases).toContain('ge');
    expect(typeof generateEpisodeCommand.handler).toBe('function');
  });

  it('should define generateSeasonCommand properly', () => {
    expect(generateSeasonCommand.name).toBe('generate:season');
    expect(generateSeasonCommand.aliases).toContain('gse');
    expect(typeof generateSeasonCommand.handler).toBe('function');
  });

  it('should define validateUniverseCommand properly', () => {
    expect(validateUniverseCommand.name).toBe('validate:universe');
    expect(validateUniverseCommand.aliases).toContain('vu');
    expect(typeof validateUniverseCommand.handler).toBe('function');
  });

  it('should return error when create-universe missing name', async () => {
    const result = await createUniverseCommand.handler([], { directory: '.', template: 'suro-buya', nonInteractive: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Universe name is required');
  });

  it('should return error when generate-scene missing arguments', async () => {
    const result = await generateSceneCommand.handler([], { 'universe-dir': '.' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Usage: generate:scene');
  });

  it('should return error when generate-episode missing universeId', async () => {
    const result = await generateEpisodeCommand.handler([], { 'universe-dir': '.' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Usage: generate:episode');
  });

  it('should return error when generate-season missing universeId', async () => {
    const result = await generateSeasonCommand.handler([], { 'universe-dir': '.' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Usage: generate:season');
  });

  it('should return error when validate-universe missing universeId', async () => {
    const result = await validateUniverseCommand.handler([], { 'universe-dir': '.' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Usage: validate:universe');
  });
});
