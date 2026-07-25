#!/usr/bin/env node
/**
 * @suro-buya/cli - Suro-Buya Command Line Interface
 * 
 * Main entry point for the CLI application.
 * This is a thin wrapper that delegates to @suro-buya/cli package.
 */

import { program } from 'commander';
import chalk from 'chalk';
import { createUniverseCommand } from '@suro-buya/cli/commands/create-universe.js';
import { generateSceneCommand } from '@suro-buya/cli/commands/generate-scene.js';
import { generateEpisodeCommand } from '@suro-buya/cli/commands/generate-episode.js';
import { generateSeasonCommand } from '@suro-buya/cli/commands/generate-season.js';
import { validateUniverseCommand } from '@suro-buya/cli/commands/validate-universe.js';
import { CommandRegistry, BUILTIN_COMMANDS, createDefaultContext } from '@suro-buya/engine-v2';

const registry = new CommandRegistry();

// Register built-in commands
for (const cmd of BUILTIN_COMMANDS) {
  registry.register(cmd);
}

// Register Phase 2 commands
registry.register(createUniverseCommand);
registry.register(generateSceneCommand);
registry.register(generateEpisodeCommand);
registry.register(generateSeasonCommand);
registry.register(validateUniverseCommand);

program
  .name('suro-buya')
  .description('Suro-Buya Universe Creation CLI')
  .version('0.1.0');

program
  .command('create-universe <name>')
  .description('Create a new universe project with interactive wizard (5 steps)')
  .option('-d, --directory <directory>', 'Target directory', '.')
  .option('-t, --template <template>', 'Template to use', 'suro-buya')
  .option('--non-interactive', 'Run without prompts (use defaults)', false)
  .action(async (name, options) => {
    try {
      const cmd = registry.get('create-universe');
      if (!cmd) {
        console.error(chalk.red('Command not found: create-universe'));
        process.exit(1);
      }
      const result = await cmd.handler([name], options);
      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red('Error:'), result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error creating universe:'), error);
      process.exit(1);
    }
  });

program
  .command('generate-scene <universe> <episode> <sceneNumber>')
  .description('Generate a new scene from universe bible')
  .option('-l, --location <location>', 'Scene location', 'unknown')
  .option('-t, --time <time>', 'Time of day', 'DAY')
  .option('-c, --characters <characters>', 'Characters (comma-separated)', 'suro,buya')
  .option('--type <type>', 'Scene type', 'exposition')
  .option('--duration <duration>', 'Estimated duration (minutes)', '5')
  .option('--beats <beats>', 'Key beats (comma-separated)')
  .option('--model <model>', 'LLM model to use')
  .option('--temperature <temperature>', 'Temperature', '0.7')
  .option('--universe-dir <dir>', 'Universe directory', '.')
  .action(async (universe, episode, sceneNumber, options) => {
    try {
      const sceneNum = parseInt(sceneNumber);
      
      const result = await registry.get('generate:scene')?.handler([
        universe,
        episode,
        String(sceneNum)
      ], {
        location: options.location,
        time: options.time,
        characters: options.characters,
        type: options.type,
        duration: parseInt(options.duration),
        beats: options.beats,
        model: options.model,
        temperature: parseFloat(options.temperature),
        'universe-dir': options.universeDir,
      });
      
      if (result?.success) {
        console.log(chalk.green(result.message));
        console.log(chalk.gray(JSON.stringify(result.data, null, 2)));
      } else {
        console.error(chalk.red('Error generating scene:'), result?.message || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error generating scene:'), error);
      process.exit(1);
    }
  });

program
  .command('generate-episode <universe> <season> <episode>')
  .description('Generate an episode plan and all scenes')
  .option('-t, --title <title>', 'Episode title', 'Untitled Episode')
  .option('-a, --arc <arc>', 'Story arc')
  .option('-c, --characters <characters>', 'Focus characters (comma-separated)', 'suro,buya')
  .option('-p, --plot-points <plotPoints>', 'Key plot points (comma-separated)')
  .option('--themes <themes>', 'Themes (comma-separated)')
  .option('-r, --runtime <runtime>', 'Target runtime (minutes)', '22')
  .option('-s, --scenes <scenes>', 'Number of scenes', '5')
  .option('--model <model>', 'LLM model to use')
  .option('--temperature <temperature>', 'Temperature', '0.3')
  .option('--universe-dir <dir>', 'Universe directory', '.')
  .action(async (universe, season, episode, options) => {
    try {
      const result = await registry.get('generate:episode')?.handler([
        universe,
        season,
        episode
      ], {
        title: options.title,
        arc: options.arc,
        characters: options.characters,
        plotPoints: options.plotPoints,
        themes: options.themes,
        runtime: parseInt(options.runtime),
        scenes: parseInt(options.scenes),
        model: options.model,
        temperature: parseFloat(options.temperature),
        'universe-dir': options.universeDir,
      });
      
      if (result?.success) {
        console.log(chalk.green(result.message));
        console.log(chalk.gray(JSON.stringify(result.data, null, 2)));
      } else {
        console.error(chalk.red('Error generating episode:'), result?.message || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error generating episode:'), error);
      process.exit(1);
    }
  });

program
  .command('generate-season <universe> <season>')
  .description('Generate a season arc and episode breakdown')
  .option('-t, --title <title>', 'Season title')
  .option('-a, --arc <arc>', 'Season arc summary')
  .option('-e, --episodes <episodes>', 'Number of episodes', '10')
  .option('-c, --characters <characters>', 'Main characters (comma-separated)', 'suro,buya')
  .option('--themes <themes>', 'Season themes (comma-separated)')
  .option('--model <model>', 'LLM model to use')
  .option('--temperature <temperature>', 'Temperature', '0.3')
  .option('--universe-dir <dir>', 'Universe directory', '.')
  .action(async (universe, season, options) => {
    try {
      const result = await registry.get('generate:season')?.handler([
        universe,
        season
      ], {
        title: options.title,
        arc: options.arc,
        episodes: parseInt(options.episodes),
        characters: options.characters,
        themes: options.themes,
        model: options.model,
        temperature: parseFloat(options.temperature),
        'universe-dir': options.universeDir,
      });
      
      if (result?.success) {
        console.log(chalk.green(result.message));
        console.log(chalk.gray(JSON.stringify(result.data, null, 2)));
      } else {
        console.error(chalk.red('Error generating season:'), result?.message || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error generating season:'), error);
      process.exit(1);
    }
  });

program
  .command('validate-universe <universe>')
  .description('Validate universe bible against canon rules')
  .option('-t, --type <type>', 'Content type (scene|episode|story|character|world)', 'universe')
  .option('-s, --strict', 'Strict validation mode', false)
  .option('-f, --file <file>', 'Specific file to validate')
  .option('--universe-dir <dir>', 'Universe directory', '.')
  .action(async (universe, options) => {
    try {
      const result = await registry.get('validate:universe')?.handler([
        universe
      ], {
        type: options.type,
        strict: options.strict,
        file: options.file,
        'universe-dir': options.universeDir,
      });
      
      if (result?.success) {
        console.log(chalk.green(result.message));
        if (result.data) {
          console.log(chalk.gray(JSON.stringify(result.data, null, 2)));
        }
      } else {
        console.error(chalk.red('Validation failed:'), result?.message || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error);
      process.exit(1);
    }
  });

// Legacy commands for backward compatibility
program
  .command('validate <universe> <file>')
  .description('Validate content against canon (legacy command)')
  .option('-t, --type <type>', 'Content type (scene|episode|story|character|world)', 'scene')
  .option('-s, --strict', 'Strict validation mode', false)
  .action(async (universe, file, options) => {
    try {
      const result = await registry.get('validate')?.handler([
        universe,
        file
      ], {
        type: options.type,
        strict: options.strict,
      });
      
      if (result?.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red('Validation failed:'), result?.message || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('init <name>')
  .description('Initialize a new universe project (legacy)')
  .option('-t, --template <template>', 'Template to use', 'suro-buya')
  .option('-d, --directory <directory>', 'Target directory', '.')
  .action(async (name, options) => {
    try {
      const result = await registry.get('init')?.handler([
        name
      ], {
        template: options.template,
        directory: options.directory,
      });
      
      if (result?.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red('Initialization failed:'), result?.message || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error initializing universe:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show engine status')
  .action(async () => {
    try {
      const result = await registry.get('status')?.handler([], {});
      if (result?.success) {
        console.log(chalk.blue(result.message));
        console.log(chalk.gray(JSON.stringify(result.data, null, 2)));
      }
    } catch (error) {
      console.error(chalk.red('Error getting status:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);