/**
 * Suro-Buya Engine v2 - Bible Loader Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BibleLoader, createBibleLoader, DEFAULT_BIBLE_KEYS } from '../src/bible/loader.js';
import { BibleKey, BibleFile } from '../src/bible/types.js';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';

// Test universe directory
const TEST_UNIVERSE_ROOT = join(process.cwd(), 'test-universe-loader');
const TEST_UNIVERSE_ID = 'test-universe';

describe('BibleLoader', () => {
  beforeEach(() => {
    // Clean up and create test directory structure
    if (existsSync(TEST_UNIVERSE_ROOT)) {
      rmSync(TEST_UNIVERSE_ROOT, { recursive: true, force: true });
    }
    
    // Create directory structure
    const bibleDir = join(TEST_UNIVERSE_ROOT, TEST_UNIVERSE_ID, 'bible');
    const charDir = join(bibleDir, '01-character-bible');
    const worldDir = join(bibleDir, '02-world-bible');
    const storyDir = join(bibleDir, '03-story-bible');
    const customDir = join(bibleDir, 'custom');
    
    mkdirSync(charDir, { recursive: true });
    mkdirSync(worldDir, { recursive: true });
    mkdirSync(storyDir, { recursive: true });
    mkdirSync(customDir, { recursive: true });
    
    // Create test bible files
    writeFileSync(join(charDir, 'overview.md'), '# Character Overview\nMain characters: Suro, Buya');
    writeFileSync(join(charDir, 'canon-rules.md'), '# Canon Rules\n1. No magic\n2. Steam power only');
    writeFileSync(join(charDir, 'voice-guide.md'), '# Voice Guide\nSuro: Technical, curious\nBuya: Poetic, wind-based');
    writeFileSync(join(charDir, 'relationships.md'), '# Relationships\nSuro <-> Buya: Partners');
    writeFileSync(join(charDir, 'suro.md'), '# Suro\nA curious young inventor');
    writeFileSync(join(charDir, 'buya.md'), '# Buya\nA wind-reading companion');
    writeFileSync(join(worldDir, 'aetheris.md'), '# Aetheris\nWorld of floating islands');
    writeFileSync(join(storyDir, 'episode-formula.md'), '# Episode Formula\n3 acts, 6 scenes');
    writeFileSync(join(storyDir, 'season-structure.md'), '# Season Structure\n13 episodes per season');
    writeFileSync(join(customDir, 'tech-guide.md'), '# Technology Guide\nSteam-powered everything');
  });
  
  afterEach(() => {
    if (existsSync(TEST_UNIVERSE_ROOT)) {
      rmSync(TEST_UNIVERSE_ROOT, { recursive: true, force: true });
    }
  });
  
  describe('Constructor', () => {
    it('should create loader with default config', () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      expect(loader).toBeInstanceOf(BibleLoader);
    });
    
    it('should use custom whitelist', () => {
      const customWhitelist: BibleKey[] = ['characterOverview', 'custom:tech-guide'];
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { 
        universeRoot: TEST_UNIVERSE_ROOT,
        whitelist: customWhitelist 
      });
      expect(loader).toBeInstanceOf(BibleLoader);
    });
    
    it('should disable cache when configured', () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { 
        universeRoot: TEST_UNIVERSE_ROOT,
        cacheEnabled: false 
      });
      expect(loader).toBeInstanceOf(BibleLoader);
    });
  });
  
  describe('load()', () => {
    it('should load standard bible file by key', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const file = await loader.load('characterOverview');
      
      expect(file).not.toBeNull();
      expect(file!.key).toBe('characterOverview');
      expect(file!.content).toContain('Character Overview');
      expect(file!.tokens).toBeGreaterThan(0);
    });
    
    it('should load canon rules', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const file = await loader.load('canonRules');
      
      expect(file).not.toBeNull();
      expect(file!.key).toBe('canonRules');
      expect(file!.content).toContain('Canon Rules');
    });
    
    it('should load voice guide', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const file = await loader.load('voiceGuide');
      
      expect(file).not.toBeNull();
      expect(file!.content).toContain('Voice Guide');
    });
    
    it('should load character file by dynamic key', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const file = await loader.load('character:suro');
      
      expect(file).not.toBeNull();
      expect(file!.key).toBe('character:suro');
      expect(file!.content).toContain('Suro');
    });
    
    it('should return null for non-existent file', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const file = await loader.load('character:nonexistent');
      
      expect(file).toBeNull();
    });
    
    it('should return null for non-whitelisted key', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { 
        universeRoot: TEST_UNIVERSE_ROOT,
        whitelist: ['characterOverview'] // Only whitelist one key
      });
      const file = await loader.load('canonRules');
      
      expect(file).toBeNull();
    });
    
    it('should cache loaded files when cache enabled', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { 
        universeRoot: TEST_UNIVERSE_ROOT,
        cacheEnabled: true 
      });
      
      // First load
      const file1 = await loader.load('characterOverview');
      // Second load should come from cache
      const file2 = await loader.load('characterOverview');
      
      expect(file1).toBe(file2); // Same object reference from cache
    });
    
    it('should not cache when cache disabled', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { 
        universeRoot: TEST_UNIVERSE_ROOT,
        cacheEnabled: false 
      });
      
      const file1 = await loader.load('characterOverview');
      const file2 = await loader.load('characterOverview');
      
      expect(file1).not.toBe(file2); // Different objects
      expect(file1!.content).toBe(file2!.content); // But same content
    });
    
    it('should throw error for file exceeding max size', async () => {
      const largeContent = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1 byte
      const largeFile = join(TEST_UNIVERSE_ROOT, TEST_UNIVERSE_ID, 'bible', '01-character-bible', 'large.md');
      writeFileSync(largeFile, largeContent);
      
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { 
        universeRoot: TEST_UNIVERSE_ROOT,
        maxFileSize: 1024 * 1024 // 1MB limit
      });
      
      await expect(loader.load('character:large')).rejects.toThrow('Bible file too large');
    });
  });
  
  describe('loadAll()', () => {
    it('should load multiple keys at once', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const files = await loader.loadAll(['characterOverview', 'canonRules', 'voiceGuide']);
      
      expect(files).toHaveLength(3);
      expect(files.map(f => f.key).sort()).toEqual(['canonRules', 'characterOverview', 'voiceGuide']);
    });
    
    it('should skip non-existent keys', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const files = await loader.loadAll(['characterOverview', 'custom:nonexistent', 'canonRules']);
      
      expect(files).toHaveLength(2);
    });
  });
  
  describe('loadUniverse()', () => {
    it('should load all whitelisted bible files', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const files = await loader.loadUniverse();
      
      expect(files.length).toBeGreaterThan(0);
      // Should include standard files
      const keys = files.map(f => f.key);
      expect(keys).toContain('characterOverview');
      expect(keys).toContain('canonRules');
      expect(keys).toContain('voiceGuide');
      expect(keys).toContain('relationshipDynamic');
      expect(keys).toContain('episodeFormula');
      expect(keys).toContain('seasonStructure');
      // Should include character files
      expect(keys).toContain('character:suro');
      expect(keys).toContain('character:buya');
      // Should include world files
      expect(keys).toContain('region:aetheris');
      // Should include custom files
      expect(keys).toContain('custom:tech-guide');
    });
  });
  
  describe('getIndex()', () => {
    it('should return bible index with metadata', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      const index = await loader.getIndex();
      
      expect(index.universeId).toBe(TEST_UNIVERSE_ID);
      expect(index.files.size).toBeGreaterThan(0);
      expect(index.characterIds).toContain('suro');
      expect(index.characterIds).toContain('buya');
      expect(index.regionIds).toContain('aetheris');
      expect(index.totalTokens).toBeGreaterThan(0);
    });
  });
  
  describe('Cache management', () => {
    it('should clear cache', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      
      await loader.load('characterOverview');
      loader.clearCache();
      
      // Should not error, cache is cleared
      const file = await loader.load('characterOverview');
      expect(file).not.toBeNull();
    });
    
    it('should invalidate specific key', async () => {
      const loader = createBibleLoader(TEST_UNIVERSE_ID, { universeRoot: TEST_UNIVERSE_ROOT });
      
      const file1 = await loader.load('characterOverview');
      loader.invalidate('characterOverview');
      const file2 = await loader.load('characterOverview');
      
      expect(file1).not.toBe(file2);
    });
  });
  
  describe('DEFAULT_BIBLE_KEYS', () => {
    it('should contain all standard keys', () => {
      expect(DEFAULT_BIBLE_KEYS).toContain('characterOverview');
      expect(DEFAULT_BIBLE_KEYS).toContain('canonRules');
      expect(DEFAULT_BIBLE_KEYS).toContain('voiceGuide');
      expect(DEFAULT_BIBLE_KEYS).toContain('relationshipDynamic');
      expect(DEFAULT_BIBLE_KEYS).toContain('episodeFormula');
      expect(DEFAULT_BIBLE_KEYS).toContain('seasonStructure');
    });
  });
});