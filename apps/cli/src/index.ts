#!/usr/bin/env node
/**
 * @suro-buya/cli - Suro-Buya Command Line Interface
 * 
 * Main entry point for the CLI application.
 */

import { program } from 'commander';
import chalk from 'chalk';
import { CommandRegistry, BUILTIN_COMMANDS, parseArgs, createDefaultContext, getEngineStatus } from '@suro-buya/engine-v2';

const registry = new CommandRegistry();
for (const cmd of BUILTIN_COMMANDS) {
  registry.register(cmd);
}

program
  .name('suro-buya')
  .description('Suro-Buya Universe Creation CLI')
  .version('0.1.0');

program
  .command('generate <universe> <episode> <sceneNumber>')
  .description('Generate a new scene from universe bible')
  .option('-l, --location <location>', 'Scene location', 'unknown')
  .option('-t, --time <time>', 'Time of day', 'DAY')
  .option('-c, --characters <characters>', 'Characters (comma-separated)', 'suro,buya')
  .option('--type <type>', 'Scene type', 'exposition')
  .option('--duration <duration>', 'Estimated duration (minutes)', '5')
  .option('--beats <beats>', 'Key beats (comma-separated)')
  .option('--model <model>', 'LLM model to use')
  .option('--temperature <temperature>', 'Temperature', '0.7')
  .action(async (universe, episode, sceneNumber, options) => {
    try {
      const sceneNum = parseInt(sceneNumber);
      const context = createDefaultContext(universe);
      
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
  .command('validate <universe> <file>')
  .description('Validate universe bible against canon')
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
  .description('Initialize a new universe project')
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
