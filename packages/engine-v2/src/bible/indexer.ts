/**
 * Suro-Buya Engine v2 - Bible Indexer
 * 
 * Builds searchable index from bible files with token counting.
 */

import { BibleFile, BibleIndex, BibleKey, BibleFileMeta } from './types.js';
import type { BibleSection } from './types.js';

/**
 * Indexed bible entry for quick retrieval
 */
export interface IndexedEntry {
  key: BibleKey;
  relPath: string;
  tokens: number;
  lastModified: Date;
  sections: IndexedSection[];
}

/**
 * A section within a bible file (e.g., a character profile, a region description)
 */
export interface IndexedSection {
  id: string;
  title: string;
  content: string;
  tokens: number;
  type: 'character' | 'region' | 'rule' | 'guide' | 'formula' | 'structure' | 'custom';
  metadata: Record<string, unknown>;
}

/**
 * Search query for bible index
 */
export interface BibleSearchQuery {
  /** Search terms */
  query: string;
  
  /** Filter by section type */
  type?: IndexedSection['type'];
  
  /** Filter by character ID */
  characterId?: string;
  
  /** Filter by region ID */
  regionId?: string;
  
  /** Maximum results */
  limit?: number;
}

/**
 * Search result
 */
export interface BibleSearchResult {
  entry: IndexedEntry;
  section: IndexedSection;
  score: number;
  matchedTerms: string[];
}

/**
 * Bible indexer class
 */
export class BibleIndexer {
  private index: Map<string, IndexedEntry> = new Map();
  private universeId: string;
  private built: boolean = false;

  constructor(universeId: string) {
    this.universeId = universeId;
  }

  /**
   * Build index from bible files
   */
  async build(files: BibleFile[]): Promise<BibleIndex> {
    this.index.clear();

    for (const file of files) {
      const sections = this.extractSections(file);
      const fileKey = file.key as BibleKey;
      const entry: IndexedEntry = {
        key: fileKey,
        relPath: file.relPath,
        tokens: file.tokens,
        lastModified: file.lastModified,
        sections,
      };
      this.index.set(fileKey, entry);
    }

    this.built = true;
    return this.getIndex();
  }

  /**
   * Get the built index
   */
  getIndex(): BibleIndex {
    const fileMap = new Map<BibleKey, BibleFileMeta>();
    const characterIds: string[] = [];
    const regionIds: string[] = [];

    for (const [key, entry] of this.index) {
      const bibleKey = key as BibleKey;
      fileMap.set(bibleKey, {
        relPath: entry.relPath,
        tokens: entry.tokens,
        lastModified: entry.lastModified,
      });

      if (key.startsWith('character:')) {
        const parts = key.split(':');
        if (parts[1]) characterIds.push(parts[1]);
      } else if (key.startsWith('region:')) {
        const parts = key.split(':');
        if (parts[1]) regionIds.push(parts[1]);
      }
    }

    const totalTokens = Array.from(this.index.values()).reduce((sum, e) => sum + e.tokens, 0);

    return {
      universeId: this.universeId,
      files: fileMap,
      characterIds,
      regionIds,
      totalTokens,
    };
  }

  /**
   * Search the index
   */
  search(query: BibleSearchQuery): BibleSearchResult[] {
    if (!this.built) {
      throw new Error('Index not built yet. Call build() first.');
    }

    const terms = query.query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const results: BibleSearchResult[] = [];

    for (const entry of this.index.values()) {
      for (const section of entry.sections) {
        // Apply filters
        if (query.type && section.type !== query.type) continue;
        if (query.characterId && section.metadata['characterId'] !== query.characterId) continue;
        if (query.regionId && section.metadata['regionId'] !== query.regionId) continue;

        // Calculate relevance score
        const contentLower = section.content.toLowerCase();
        const matchedTerms = terms.filter(term => contentLower.includes(term));
        
        if (matchedTerms.length === 0) continue;

        const score = matchedTerms.length / terms.length * (1 + Math.log(section.tokens + 1));

        results.push({
          entry,
          section,
          score,
          matchedTerms,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = query.limit ?? 10;
    return results.slice(0, limit);
  }

  /**
   * Get all sections of a specific type
   */
  getSectionsByType(type: IndexedSection['type']): IndexedSection[] {
    const sections: IndexedSection[] = [];
    for (const entry of this.index.values()) {
      for (const section of entry.sections) {
        if (section.type === type) {
          sections.push(section);
        }
      }
    }
    return sections;
  }

  /**
   * Get character sections
   */
  getCharacters(): IndexedSection[] {
    return this.getSectionsByType('character');
  }

  /**
   * Get region sections
   */
  getRegions(): IndexedSection[] {
    return this.getSectionsByType('region');
  }

  /**
   * Get rule sections
   */
  getRules(): IndexedSection[] {
    return this.getSectionsByType('rule');
  }

  /**
   * Get a specific entry by key
   */
  getEntry(key: BibleKey): IndexedEntry | undefined {
    return this.index.get(key);
  }

  /**
   * Get sections for a specific entry
   */
  getSections(key: BibleKey): IndexedSection[] {
    const entry = this.index.get(key);
    return entry?.sections ?? [];
  }

  /**
   * Check if index is built
   */
  isBuilt(): boolean {
    return this.built;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear();
    this.built = false;
  }

  /**
   * Extract sections from a bible file
   */
  private extractSections(file: BibleFile): IndexedSection[] {
    const sections: IndexedSection[] = [];

    // Determine section type based on key
    let defaultType: IndexedSection['type'] = 'custom';
    if (file.key.startsWith('character:')) defaultType = 'character';
    else if (file.key.startsWith('region:')) defaultType = 'region';
    else if (file.key === 'canonRules') defaultType = 'rule';
    else if (file.key === 'voiceGuide') defaultType = 'guide';
    else if (file.key === 'episodeFormula') defaultType = 'formula';
    else if (file.key === 'seasonStructure') defaultType = 'structure';
    else if (file.key === 'characterOverview') defaultType = 'guide';
    else if (file.key === 'relationshipDynamic') defaultType = 'guide';

    // Parse markdown sections
    const mdSections = this.parseMarkdownSections(file.content);
    
    if (mdSections.length > 0) {
      for (const mdSection of mdSections) {
        sections.push({
          id: `${file.key}:${mdSection.id}`,
          title: mdSection.title,
          content: mdSection.content,
          tokens: this.estimateTokens(mdSection.content),
          type: defaultType,
          metadata: {
            ...mdSection.metadata,
            sourceKey: file.key,
            sourcePath: file.relPath,
          },
        });
      }
    } else {
      // Treat entire file as one section
      sections.push({
        id: file.key,
        title: this.formatTitle(file.key),
        content: file.content,
        tokens: file.tokens,
        type: defaultType,
        metadata: {
          sourceKey: file.key,
          sourcePath: file.relPath,
        },
      });
    }

    return sections;
  }

  /**
   * Parse markdown file into sections based on headers
   */
  private parseMarkdownSections(content: string): Array<{
    id: string;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  }> {
    const sections: Array<{
      id: string;
      title: string;
      content: string;
      metadata: Record<string, unknown>;
    }> = [];

    const lines = content.split('\n');
    let currentSection: { id: string; title: string; content: string; metadata: Record<string, unknown> } | null = null;
    let inFrontmatter = false;
    let frontmatterContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Handle frontmatter
      if (i === 0 && line.trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        if (line.trim() === '---') {
          inFrontmatter = false;
          // Parse frontmatter
          try {
            const yaml = frontmatterContent;
            // Simple YAML parsing for key: value pairs
            for (const fmLine of yaml.split('\n')) {
              const [key, ...valueParts] = fmLine.split(':');
              if (key && valueParts.length > 0) {
                if (currentSection) {
                  currentSection.metadata[key.trim()] = valueParts.join(':').trim();
                }
              }
            }
          } catch {
            // Ignore frontmatter parsing errors
          }
          frontmatterContent = '';
        } else {
          frontmatterContent += line + '\n';
        }
        continue;
      }

      // Check for markdown headers
      const headerMatch = line?.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch && headerMatch[1] && headerMatch[2]) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        currentSection = {
          id,
          title,
          content: '',
          metadata: {
            headerLevel: level,
          },
        };
      } else if (currentSection && line !== undefined) {
        currentSection.content += line + '\n';
      }
    }

    // Don't forget the last section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Format a key into a human-readable title
   */
  private formatTitle(key: BibleKey): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, c => c.toUpperCase())
      .replace(/:/g, ' - ')
      .trim();
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create a bible indexer instance
 */
export function createBibleIndexer(universeId: string): BibleIndexer {
  return new BibleIndexer(universeId);
}