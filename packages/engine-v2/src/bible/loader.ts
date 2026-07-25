/**
 * Suro-Buya Engine v2 - Bible Loader
 * 
 * Loads bible files from universe directories with config-driven whitelist
 * and in-memory caching.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import type { UniverseConfig, CharacterProfile, WorldProfile, StoryProfile, EpisodeStructure, SceneData } from '../types.js';
import { BibleFile, BibleIndex, BibleKey } from './types.js';
import type { BibleFileMeta } from './types.js';

/**
 * Bible loader configuration
 */
export interface BibleLoaderConfig {
  /** Root directory for universe bibles */
  universeRoot: string;
  /** Whitelist of allowed file patterns */
  whitelist: BibleKey[];
  /** Whether to cache loaded files */
  cacheEnabled: boolean;
  /** Maximum file size to load (bytes) */
  maxFileSize: number;
}

/**
 * Default bible keys that are always allowed
 */
export const DEFAULT_BIBLE_KEYS: BibleKey[] = [
  'characterOverview',
  'canonRules',
  'voiceGuide',
  'relationshipDynamic',
  'episodeFormula',
  'seasonStructure',
];

/**
 * Bible loader class
 */
export class BibleLoader {
  private config: BibleLoaderConfig;
  private cache: Map<string, BibleFile> = new Map();
  private universeId: string;

  constructor(universeId: string, config: Partial<BibleLoaderConfig> = {}) {
    this.universeId = universeId;
    this.config = {
      universeRoot: config.universeRoot || join(process.cwd(), 'universes'),
      whitelist: config.whitelist || DEFAULT_BIBLE_KEYS,
      cacheEnabled: config.cacheEnabled ?? true,
      maxFileSize: config.maxFileSize ?? 1024 * 1024, // 1MB default
    };
  }

  /**
   * Load a specific bible file by key
   */
  async load(key: BibleKey): Promise<BibleFile | null> {
    const cacheKey = `${this.universeId}:${key}`;
    
    // Check cache
    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const filePath = this.resolveFilePath(key);
    if (!filePath || !existsSync(filePath)) {
      return null;
    }

    const stats = statSync(filePath);
    if (stats.size > this.config.maxFileSize) {
      throw new Error(`Bible file too large: ${filePath} (${stats.size} bytes, max ${this.config.maxFileSize})`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const bibleFile: BibleFile = {
      key,
      relPath: relative(this.getUniverseDir(), filePath),
      content,
      tokens: this.estimateTokens(content),
      lastModified: stats.mtime,
    };

    if (this.config.cacheEnabled) {
      this.cache.set(cacheKey, bibleFile);
    }

    return bibleFile;
  }

  /**
   * Load multiple bible files at once
   */
  async loadAll(keys: BibleKey[]): Promise<BibleFile[]> {
    const results = await Promise.all(keys.map(key => this.load(key)));
    return results.filter((f): f is BibleFile => f !== null);
  }

  /**
   * Load all available bible files for the universe
   */
  async loadUniverse(): Promise<BibleFile[]> {
    const universeDir = this.getUniverseDir();
    if (!existsSync(universeDir)) {
      return [];
    }

    const files = this.findBibleFiles(universeDir);
    const results: BibleFile[] = [];

    for (const file of files) {
      const key = this.keyFromFilePath(file);
      if (this.isWhitelisted(key)) {
        const loaded = await this.load(key);
        if (loaded) {
          results.push(loaded);
        }
      }
    }

    return results;
  }

  /**
   * Get bible index (metadata only, no content)
   */
  async getIndex(): Promise<BibleIndex> {
    const files = await this.loadUniverse();
    
    const fileMap = new Map<BibleKey, BibleFileMeta>();
    const characterIds: string[] = [];
    const regionIds: string[] = [];

    for (const file of files) {
      fileMap.set(file.key, {
        relPath: file.relPath,
        tokens: file.tokens,
        lastModified: file.lastModified,
      });

      // Extract character/region IDs from custom keys
      const parts = file.key.split(':');
      if (file.key.startsWith('character:') && parts[1]) {
        characterIds.push(parts[1]);
      } else if (file.key.startsWith('region:') && parts[1]) {
        regionIds.push(parts[1]);
      }
    }

    const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);

    return {
      universeId: this.universeId,
      files: fileMap,
      characterIds,
      regionIds,
      totalTokens,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: BibleKey): void {
    const cacheKey = `${this.universeId}:${key}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Resolve file path for a bible key
   */
  private resolveFilePath(key: BibleKey): string | null {
    const universeDir = this.getUniverseDir();
    
    // Standard bible files
    const standardPaths: Record<Exclude<BibleKey, `character:${string}` | `region:${string}` | `custom:${string}`>, string> = {
      characterOverview: join(universeDir, 'bible', '01-character-bible', 'overview.md'),
      canonRules: join(universeDir, 'bible', '01-character-bible', 'canon-rules.md'),
      voiceGuide: join(universeDir, 'bible', '01-character-bible', 'voice-guide.md'),
      relationshipDynamic: join(universeDir, 'bible', '01-character-bible', 'relationships.md'),
      episodeFormula: join(universeDir, 'bible', '03-story-bible', 'episode-formula.md'),
      seasonStructure: join(universeDir, 'bible', '03-story-bible', 'season-structure.md'),
    };

    if (key in standardPaths) {
      return standardPaths[key as keyof typeof standardPaths];
    }

    // Dynamic keys (character:, region:, custom:)
    const [prefix, id] = key.split(':');
    if (prefix === 'character') {
      return join(universeDir, 'bible', '01-character-bible', `${id}.md`);
    } else if (prefix === 'region') {
      return join(universeDir, 'bible', '02-world-bible', `${id}.md`);
    } else if (prefix === 'custom') {
      return join(universeDir, 'bible', 'custom', `${id}.md`);
    }

    return null;
  }

  /**
   * Get universe directory
   */
  private getUniverseDir(): string {
    return join(this.config.universeRoot, this.universeId);
  }

  /**
   * Find all bible files in universe directory
   */
  private findBibleFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scan = (currentDir: string): void => {
      if (!existsSync(currentDir)) return;
      
      for (const entry of readdirSync(currentDir)) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (stat.isFile() && (extname(entry) === '.md' || extname(entry) === '.yaml' || extname(entry) === '.yml')) {
          files.push(fullPath);
        }
      }
    };

    scan(dir);
    return files;
  }

  /**
   * Extract bible key from file path
   */
  private keyFromFilePath(filePath: string): BibleKey {
    const universeDir = this.getUniverseDir();
    const relPath = relative(universeDir, filePath);
    
    // Map standard paths to keys
    if (relPath === 'bible/01-character-bible/overview.md') return 'characterOverview';
    if (relPath === 'bible/01-character-bible/canon-rules.md') return 'canonRules';
    if (relPath === 'bible/01-character-bible/voice-guide.md') return 'voiceGuide';
    if (relPath === 'bible/01-character-bible/relationships.md') return 'relationshipDynamic';
    if (relPath === 'bible/03-story-bible/episode-formula.md') return 'episodeFormula';
    if (relPath === 'bible/03-story-bible/season-structure.md') return 'seasonStructure';
    
    // Character files
    if (relPath.startsWith('bible/01-character-bible/') && relPath.endsWith('.md')) {
      const name = relPath.replace('bible/01-character-bible/', '').replace('.md', '');
      if (name !== 'overview' && name !== 'canon-rules' && name !== 'voice-guide' && name !== 'relationships') {
        return `character:${name}` as BibleKey;
      }
    }
    
    // Region files
    if (relPath.startsWith('bible/02-world-bible/') && relPath.endsWith('.md')) {
      const name = relPath.replace('bible/02-world-bible/', '').replace('.md', '');
      return `region:${name}` as BibleKey;
    }
    
    // Custom files
    if (relPath.startsWith('bible/custom/') && relPath.endsWith('.md')) {
      const name = relPath.replace('bible/custom/', '').replace('.md', '');
      return `custom:${name}` as BibleKey;
    }

    return `custom:${relPath.replace(/\.[^.]+$/, '').replace(/[/\\]/g, '-')}` as BibleKey;
  }

  /**
   * Check if key is whitelisted
   */
  private isWhitelisted(key: BibleKey): boolean {
    // Standard keys are always whitelisted
    if (DEFAULT_BIBLE_KEYS.includes(key as any)) return true;
    
    // Check custom whitelist
    return this.config.whitelist.some(w => {
      if (w === key) return true;
      // Support wildcards
      if (w.endsWith(':*')) {
        const prefix = w.slice(0, -2);
        return key.startsWith(prefix + ':');
      }
      return false;
    });
  }

  /**
   * Rough token estimation (1 token ≈ 4 chars)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}


/**
 * Create a bible loader instance
 */
export function createBibleLoader(universeId: string, config?: Partial<BibleLoaderConfig>): BibleLoader {
  return new BibleLoader(universeId, config);
}