/**
 * @suro-buya/cli - Manifest Utilities
 * 
 * Utility functions for universe manifest (universe.yaml) generation and validation.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import type { UniverseConfig } from '@suro-buya/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Universe manifest schema (mirrors universe.yaml structure)
 */
export interface UniverseManifest {
  id: string;
  name: string;
  description?: string;
  version: string;
  defaultLanguage: string;
  bibleRoot: string;
  characters: ManifestCharacter[];
  regions: ManifestRegion[];
  canonRules: ManifestCanonRule[];
  aiProviders: ManifestAIProviders;
  generationDefaults: ManifestGenerationDefaults;
  story?: {
    tone?: string;
    themes?: string[];
    targetAudience?: string;
  };
  seasons?: Array<{
    number: number;
    episodes?: Array<{ number: number }>;
  }>;
  episodes?: Array<{ number: number }>;
  targetAudience?: string;
}

export interface ManifestCharacter {
  id: string;
  name: string;
  role: 'PROTAGONIST' | 'DEUTERAGONIST' | 'SUPPORTING' | 'ANTAGONIST' | 'NARRATOR';
  displayName: string;
  description?: string;
  coreTraits: string[];
  coreWeakness: string;
  voiceGuide: string;
  bibleRef?: string;
  metadata?: Record<string, unknown>;
}

export interface ManifestRegion {
  id: string;
  name: string;
  description?: string;
  cultureGuide: string;
  geography?: string;
  metadata?: Record<string, unknown>;
}

export interface ManifestCanonRule {
  ruleId: string;
  name: string;
  description: string;
  ruleType: 'BANNED_WORD' | 'REQUIRED_ELEMENT' | 'STRUCTURE' | 'CHARACTER_CONSISTENCY' | 'CUSTOM_LLM';
  pattern?: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface ManifestAIProviders {
  creativeGeneration: string;
  planning: string;
  validation: string;
  embedding: string;
  imagePrompt: string;
  codeGeneration: string;
}

export interface ManifestGenerationDefaults {
  sceneTargetLines: number;
  episodeTargetScenes: number;
  temperature: number;
  maxRetries: number;
}

/**
 * Generate universe manifest from wizard answers
 */
export function generateManifest(answers: WizardAnswers): UniverseManifest {
  const universeId = slugify(answers.universeName);
  
  return {
    id: universeId,
    name: answers.universeName,
    description: answers.description,
    version: '1.0.0',
    defaultLanguage: answers.defaultLanguage || 'id',
    bibleRoot: './bible',
    characters: answers.characters.map((c, i) => ({
      id: c.id || slugify(c.name) || `character-${i + 1}`,
      name: c.name,
      role: (c.role || (i === 0 ? 'PROTAGONIST' : 'SUPPORTING')) as ManifestCharacter['role'],
      displayName: c.displayName || c.name,
      description: c.description,
      coreTraits: c.coreTraits || ['brave', 'curious'],
      coreWeakness: c.coreWeakness || 'Overconfidence',
      voiceGuide: `./bible/01-character-bible/voice-${slugify(c.name)}.md`,
      bibleRef: `./bible/01-character-bible/${slugify(c.name)}.md`,
      metadata: {},
    })),
    regions: answers.regions.map((r, i) => ({
      id: r.id || slugify(r.name) || `region-${i + 1}`,
      name: r.name,
      description: r.description,
      cultureGuide: `./bible/02-world-bible/culture-${slugify(r.name)}.md`,
      geography: `./bible/02-world-bible/geography-${slugify(r.name)}.md`,
      metadata: {},
    })),
    canonRules: getDefaultCanonRules(answers),
    aiProviders: getDefaultAIProviders(answers.aiProvider),
    generationDefaults: {
      sceneTargetLines: 10,
      episodeTargetScenes: 6,
      temperature: 0.7,
      maxRetries: 2,
    },
  };
}

/**
 * Get default canon rules based on answers
 */
function getDefaultCanonRules(answers: WizardAnswers): ManifestCanonRule[] {
  const rules: ManifestCanonRule[] = [
    {
      ruleId: 'no-violence',
      name: 'No Graphic Violence',
      description: 'Content must be appropriate for all ages',
      ruleType: 'BANNED_WORD',
      pattern: '\\b(kill|murder|blood|gore|death)\\b',
      severity: 'ERROR',
      isActive: true,
      metadata: {},
    },
    {
      ruleId: 'weakness-consequence',
      name: 'Weakness Must Have Consequence',
      description: 'Character weaknesses must have narrative consequences',
      ruleType: 'CHARACTER_CONSISTENCY',
      severity: 'WARNING',
      isActive: true,
      metadata: {
        llmJudgePrompt: 'Check if character weaknesses lead to meaningful consequences in the story',
      },
    },
  ];

  if (answers.targetAudience === 'children') {
    rules.push({
      ruleId: 'no-scary-content',
      name: 'No Scary Content',
      description: 'Avoid content that may frighten young children',
      ruleType: 'CUSTOM_LLM',
      severity: 'WARNING',
      isActive: true,
      metadata: {
        llmJudgePrompt: 'Evaluate if content contains frightening elements inappropriate for children under 12',
      },
    });
  }

  if (answers.tone === 'comedic') {
    rules.push({
      ruleId: 'maintain-comedy-tone',
      name: 'Maintain Comedic Tone',
      description: 'Ensure scenes maintain lighthearted, comedic tone',
      ruleType: 'CUSTOM_LLM',
      severity: 'INFO',
      isActive: true,
      metadata: {
        llmJudgePrompt: 'Check if scene maintains comedic tone without becoming too dark',
      },
    });
  }

  return rules;
}

/**
 * Get default AI providers based on preference
 */
function getDefaultAIProviders(preference?: string): ManifestAIProviders {
  const presets: Record<string, ManifestAIProviders> = {
    'anthropic': {
      creativeGeneration: 'anthropic:claude-3-5-sonnet-20241022',
      planning: 'openai:gpt-4o-2024-08-06',
      validation: 'anthropic:claude-3-5-haiku-20241022',
      embedding: 'cohere:embed-multilingual-v3',
      imagePrompt: 'openai:gpt-4o-2024-08-06',
      codeGeneration: 'anthropic:claude-3-5-sonnet-20241022',
    },
    'openai': {
      creativeGeneration: 'openai:gpt-4o-2024-08-06',
      planning: 'openai:gpt-4o-2024-08-06',
      validation: 'openai:gpt-4o-mini-2024-07-18',
      embedding: 'openai:text-embedding-3-small',
      imagePrompt: 'openai:gpt-4o-2024-08-06',
      codeGeneration: 'openai:gpt-4o-2024-08-06',
    },
    'balanced': {
      creativeGeneration: 'anthropic:claude-3-5-sonnet-20241022',
      planning: 'openai:gpt-4o-2024-08-06',
      validation: 'anthropic:claude-3-5-haiku-20241022',
      embedding: 'cohere:embed-multilingual-v3',
      imagePrompt: 'openai:gpt-4o-2024-08-06',
      codeGeneration: 'anthropic:claude-3-5-sonnet-20241022',
    },
  };

  return presets[preference || 'balanced'] ?? presets['balanced']!;
}

/**
 * Write manifest to universe.yaml
 */
export async function writeManifest(
  universeDir: string,
  manifest: UniverseManifest
): Promise<void> {
  const yamlContent = `# Universe Manifest: ${manifest.name}
# Generated by suro-buya CLI
# Schema: packages/templates/universe/schema/metadata.md

${yaml.stringify(manifest, { 
  indent: 2,
  lineWidth: 120,
  nullStr: '',
  defaultKeyType: 'PLAIN',
})}`;

  await fs.writeFile(path.join(universeDir, 'universe.yaml'), yamlContent, 'utf-8');
}

/**
 * Read and parse universe.yaml
 */
export async function readManifest(universeDir: string): Promise<UniverseManifest | null> {
  const manifestPath = path.join(universeDir, 'universe.yaml');
  
  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }
  
  const content = await fs.readFile(manifestPath, 'utf-8');
  return yaml.parse(content) as UniverseManifest;
}

/**
 * Validate manifest structure
 */
export function validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const m = manifest as Record<string, unknown>;
  
  const mId = m['id'];
  const mName = m['name'];
  const mVersion = m['version'];
  const mBibleRoot = m['bibleRoot'];
  const mCharacters = m['characters'];
  const mRegions = m['regions'];
  const mCanonRules = m['canonRules'];

  if (!mId || typeof mId !== 'string') {
    errors.push('Missing or invalid "id" field');
  } else if (!/^[a-z0-9-]+$/.test(mId)) {
    errors.push('ID must be lowercase alphanumeric with hyphens only');
  }
  
  if (!mName || typeof mName !== 'string') {
    errors.push('Missing or invalid "name" field');
  }
  
  if (!mVersion || typeof mVersion !== 'string') {
    errors.push('Missing or invalid "version" field');
  } else if (!/^\d+\.\d+\.\d+$/.test(mVersion)) {
    errors.push('Version must be semantic version (x.y.z)');
  }
  
  if (!mBibleRoot || typeof mBibleRoot !== 'string') {
    errors.push('Missing or invalid "bibleRoot" field');
  }
  
  if (!Array.isArray(mCharacters)) {
    errors.push('Missing or invalid "characters" array');
  } else {
    mCharacters.forEach((c: unknown, i: number) => {
      const char = c as Record<string, unknown>;
      const charId = char['id'];
      const charName = char['name'];
      const charRole = char['role'];
      if (!charId || typeof charId !== 'string') {
        errors.push(`Character ${i}: missing or invalid "id"`);
      }
      if (!charName || typeof charName !== 'string') {
        errors.push(`Character ${i}: missing or invalid "name"`);
      }
      if (!charRole || !['PROTAGONIST', 'DEUTERAGONIST', 'SUPPORTING', 'ANTAGONIST', 'NARRATOR'].includes(charRole as string)) {
        errors.push(`Character ${i}: invalid "role"`);
      }
    });
  }
  
  if (!Array.isArray(mRegions)) {
    errors.push('Missing or invalid "regions" array');
  }
  
  if (!Array.isArray(mCanonRules)) {
    errors.push('Missing or invalid "canonRules" array');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Convert universe manifest to UniverseConfig for engine
 */
export function manifestToConfig(manifest: UniverseManifest): UniverseConfig {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    locale: manifest.defaultLanguage,
    locales: [manifest.defaultLanguage, 'en-US'],
    timezone: 'Asia/Jakarta',
    metadata: {
      description: manifest.description,
      bibleRoot: manifest.bibleRoot,
      characters: manifest.characters,
      regions: manifest.regions,
      canonRules: manifest.canonRules,
      aiProviders: manifest.aiProviders,
      generationDefaults: manifest.generationDefaults,
    },
  };
}

/**
 * Wizard answers interface
 */
export interface WizardAnswers {
  universeName: string;
  description?: string;
  defaultLanguage?: string;
  targetAudience: 'children' | 'teens' | 'all-ages' | 'mature';
  tone: 'hopeful' | 'comedic' | 'dramatic' | 'mysterious' | 'epic';
  aiProvider?: string;
  characters: Array<{
    id?: string;
    name: string;
    role?: string;
    displayName?: string;
    description?: string;
    coreTraits?: string[];
    coreWeakness?: string;
  }>;
  regions: Array<{
    id?: string;
    name: string;
    description?: string;
  }>;
}

/**
 * Slugify a string for use as ID
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate universe ID format
 */
export function validateUniverseId(id: string): { valid: boolean; error?: string } {
  if (!id) {
    return { valid: false, error: 'Universe ID is required' };
  }
  
  if (!/^[a-z0-9-]+$/.test(id)) {
    return { valid: false, error: 'Universe ID must be lowercase alphanumeric with hyphens only' };
  }
  
  if (id.length > 64) {
    return { valid: false, error: 'Universe ID must be 64 characters or less' };
  }
  
  if (id.startsWith('-') || id.endsWith('-')) {
    return { valid: false, error: 'Universe ID cannot start or end with hyphen' };
  }
  
  if (id.includes('--')) {
    return { valid: false, error: 'Universe ID cannot contain consecutive hyphens' };
  }
  
  return { valid: true };
}