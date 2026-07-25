/**
 * @suro-buya/cli - Create Universe Command
 * 
 * Interactive wizard for creating a new universe project.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import type { CommandDefinition } from '@suro-buya/engine-v2/commands.js';
import { scaffoldUniverse } from '../utils/scaffold.js';
import { generateManifest, writeManifest, validateUniverseId, type WizardAnswers } from '../utils/manifest.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Create universe command definition
 */
export const createUniverseCommand: CommandDefinition = {
  name: 'create-universe',
  description: 'Create a new universe project with interactive wizard (5 steps)',
  usage: 'suro-buya create-universe <name>',
  aliases: ['cu', 'new'],
  options: [
    { name: 'directory', alias: 'd', description: 'Target directory', type: 'string', default: '.' },
    { name: 'template', alias: 't', description: 'Template to use', type: 'string', default: 'suro-buya' },
    { name: 'non-interactive', description: 'Run without prompts (use defaults)', type: 'boolean', default: false },
  ],
  handler: async (args, options) => {
    const universeName = args[0];
    if (!universeName) {
      return {
        success: false,
        message: 'Universe name is required',
      };
    }

    const targetDir = path.resolve(options['directory'] as string, universeName);
    const template = options['template'] as string;
    const nonInteractive = options['nonInteractive'] as boolean;

    // Validate universe ID
    const validation = validateUniverseId(universeName);
    if (!validation.valid) {
      return {
        success: false,
        message: `Invalid universe name: ${validation.error}`,
      };
    }

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
      if (!nonInteractive) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Directory "${targetDir}" already exists. Overwrite?`,
            default: false,
          },
        ]);
        if (!overwrite) {
          return {
            success: false,
            message: 'Operation cancelled',
          };
        }
      } else {
        return {
          success: false,
          message: `Directory "${targetDir}" already exists`,
        };
      }
    }

    try {
      console.log(chalk.blue.bold('\n🌟 Suro-Buya Universe Creator\n'));
      console.log(chalk.gray('Creating new universe:'), chalk.cyan(universeName));
      console.log(chalk.gray('Target directory:'), chalk.cyan(targetDir));
      console.log(chalk.gray('Template:'), chalk.cyan(template));
      console.log('');

      let answers: WizardAnswers;

      if (nonInteractive) {
        answers = getDefaultAnswers(universeName);
      } else {
        answers = await runWizard(universeName);
      }

      // Step 5: Generate manifest and scaffold
      console.log(chalk.blue('\n📦 Step 5/5: Scaffolding universe structure...\n'));
      
      const manifest = generateManifest(answers);
      await scaffoldUniverse(targetDir, answers.universeName, answers.universeName, template);
      await writeManifest(targetDir, manifest);

      console.log(chalk.green('\n✨ Universe created successfully!\n'));
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray(`  cd ${universeName}`));
      console.log(chalk.gray('  suro-buya generate-scene <universe> <episode> <scene>'));
      console.log(chalk.gray('  suro-buya validate-universe <universe>'));
      console.log('');

      return {
        success: true,
        message: `Universe "${universeName}" created at ${targetDir}`,
        data: {
          universeId: manifest.id,
          path: targetDir,
          manifest,
        },
      };
    } catch (error) {
      console.error(chalk.red('Error creating universe:'), error);
      return {
        success: false,
        message: `Failed to create universe: ${error}`,
      };
    }
  },
};

/**
 * Run the interactive wizard (5 steps)
 */
async function runWizard(universeName: string): Promise<WizardAnswers> {
  console.log(chalk.yellow('📋 Wizard: 5 Steps to Create Your Universe\n'));

  // Step 1: Basic Info
  console.log(chalk.blue.bold('Step 1/5: Basic Information'));
  const basic = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Universe description (one paragraph):',
      default: 'A new adventure universe',
    },
    {
      type: 'list',
      name: 'defaultLanguage',
      message: 'Default language:',
      choices: [
        { name: 'Indonesian (id)', value: 'id' },
        { name: 'English (en)', value: 'en' },
      ],
      default: 'id',
    },
    {
      type: 'list',
      name: 'targetAudience',
      message: 'Target audience:',
      choices: [
        { name: 'Children (ages 7-12)', value: 'children' },
        { name: 'Teens (ages 13-17)', value: 'teens' },
        { name: 'All Ages', value: 'all-ages' },
        { name: 'Mature (18+)', value: 'mature' },
      ],
      default: 'all-ages',
    },
    {
      type: 'list',
      name: 'tone',
      message: 'Story tone:',
      choices: [
        { name: 'Hopeful & Adventurous', value: 'hopeful' },
        { name: 'Comedic & Lighthearted', value: 'comedic' },
        { name: 'Dramatic & Emotional', value: 'dramatic' },
        { name: 'Mysterious & Suspenseful', value: 'mysterious' },
        { name: 'Epic & Grand', value: 'epic' },
      ],
      default: 'hopeful',
    },
  ]);

  // Step 2: AI Provider
  console.log(chalk.blue.bold('\nStep 2/5: AI Provider Configuration'));
  const ai = await inquirer.prompt([
    {
      type: 'list',
      name: 'aiProvider',
      message: 'Preferred AI provider:',
      choices: [
        { name: 'Balanced (Anthropic + OpenAI)', value: 'balanced' },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
      ],
      default: 'balanced',
    },
  ]);

  // Step 3: Characters
  console.log(chalk.blue.bold('\nStep 3/5: Main Characters'));
  const { characterCount } = await inquirer.prompt([
    {
      type: 'number',
      name: 'characterCount',
      message: 'How many main characters?',
      default: 2,
      validate: (input) => input >= 1 && input <= 10 || 'Must be between 1 and 10',
    },
  ]);

  const characters = [];
  for (let i = 0; i < characterCount; i++) {
    console.log(chalk.gray(`\n  Character ${i + 1}:`));
    const char = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '  Character name:',
        default: i === 0 ? 'Protagonist' : `Character ${i + 1}`,
        validate: (input) => input.length > 0 || 'Name is required',
      },
      {
        type: 'list',
        name: 'role',
        message: '  Role:',
        choices: [
          { name: 'Protagonist', value: 'PROTAGONIST' },
          { name: 'Deuteragonist (Second Lead)', value: 'DEUTERAGONIST' },
          { name: 'Supporting', value: 'SUPPORTING' },
          { name: 'Antagonist', value: 'ANTAGONIST' },
          { name: 'Narrator', value: 'NARRATOR' },
        ],
        default: i === 0 ? 'PROTAGONIST' : 'SUPPORTING',
      },
      {
        type: 'input',
        name: 'description',
        message: '  Brief description:',
        default: 'A compelling character',
      },
      {
        type: 'input',
        name: 'coreTraits',
        message: '  Core traits (comma-separated):',
        default: 'brave,curious,determined',
      },
      {
        type: 'input',
        name: 'coreWeakness',
        message: '  Core weakness (with consequence):',
        default: 'Overconfidence leading to reckless decisions',
      },
    ]);
    
    characters.push({
      ...char,
      coreTraits: char.coreTraits.split(',').map((t: string) => t.trim()),
    });
  }

  // Step 4: Regions/World
  console.log(chalk.blue.bold('\nStep 4/5: World Regions'));
  const { regionCount } = await inquirer.prompt([
    {
      type: 'number',
      name: 'regionCount',
      message: 'How many main regions?',
      default: 1,
      validate: (input) => input >= 1 && input <= 5 || 'Must be between 1 and 5',
    },
  ]);

  const regions = [];
  for (let i = 0; i < regionCount; i++) {
    console.log(chalk.gray(`\n  Region ${i + 1}:`));
    const region = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '  Region name:',
        default: i === 0 ? 'Main Region' : `Region ${i + 1}`,
        validate: (input) => input.length > 0 || 'Name is required',
      },
      {
        type: 'input',
        name: 'description',
        message: '  Brief description:',
        default: 'A key location in the story',
      },
    ]);
    regions.push(region);
  }

  // Step 5: Confirmation
  console.log(chalk.blue.bold('\nStep 5/5: Confirmation'));
  console.log(chalk.gray('\nSummary:'));
  console.log(chalk.gray(`  Universe: ${universeName}`));
  console.log(chalk.gray(`  Description: ${basic.description}`));
  console.log(chalk.gray(`  Language: ${basic.defaultLanguage}`));
  console.log(chalk.gray(`  Audience: ${basic.targetAudience}`));
  console.log(chalk.gray(`  Tone: ${basic.tone}`));
  console.log(chalk.gray(`  AI Provider: ${ai.aiProvider}`));
  console.log(chalk.gray(`  Characters: ${characters.length}`));
  console.log(chalk.gray(`  Regions: ${regions.length}`));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Create universe with these settings?',
      default: true,
    },
  ]);

  if (!confirm) {
    throw new Error('Operation cancelled by user');
  }

  return {
    universeName,
    description: basic.description,
    defaultLanguage: basic.defaultLanguage,
    targetAudience: basic.targetAudience,
    tone: basic.tone,
    aiProvider: ai.aiProvider,
    characters,
    regions,
  };
}

/**
 * Get default answers for non-interactive mode
 */
function getDefaultAnswers(universeName: string): WizardAnswers {
  return {
    universeName,
    description: 'A new adventure universe created via CLI',
    defaultLanguage: 'id',
    targetAudience: 'all-ages',
    tone: 'hopeful',
    aiProvider: 'balanced',
    characters: [
      {
        name: 'Protagonist',
        role: 'PROTAGONIST',
        description: 'Main hero of the story',
        coreTraits: ['brave', 'curious', 'determined'],
        coreWeakness: 'Overconfidence leading to reckless decisions',
      },
      {
        name: 'Companion',
        role: 'DEUTERAGONIST',
        description: 'Loyal companion and friend',
        coreTraits: ['loyal', 'wise', 'cautious'],
        coreWeakness: 'Overprotective nature',
      },
    ],
    regions: [
      {
        name: 'Main Region',
        description: 'Primary setting of the adventure',
      },
    ],
  };
}