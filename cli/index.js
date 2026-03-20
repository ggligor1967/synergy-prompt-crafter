#!/usr/bin/env node
import { program } from 'commander';
import { listCommand, getCommand, deleteCommand, exportCommand, createCommand } from './commands.js';

const DEFAULT_URL = process.env.SYNERGY_API_URL || 'http://localhost:3001';

program
  .name('synergy-prompt')
  .description('CLI for Synergy Prompt Crafter')
  .version('1.0.0');

program
  .command('list')
  .description('List all saved prompts')
  .option('-s, --search <query>', 'Filter by title, core idea, or generated text')
  .option('--url <url>', 'API base URL', DEFAULT_URL)
  .option('--json', 'Output raw JSON')
  .action(listCommand);

program
  .command('get <id>')
  .description('Show a prompt by ID')
  .option('--url <url>', 'API base URL', DEFAULT_URL)
  .option('--json', 'Output raw JSON')
  .action(getCommand);

program
  .command('create')
  .description('Create a new prompt')
  .requiredOption('--title <title>', 'Prompt title')
  .option('--idea <text>', 'Core idea')
  .option('--prompt <text>', 'Generated prompt text')
  .option('--url <url>', 'API base URL', DEFAULT_URL)
  .option('--json', 'Output raw JSON')
  .action(createCommand);

program
  .command('delete <id>')
  .description('Delete a prompt by ID')
  .option('--url <url>', 'API base URL', DEFAULT_URL)
  .action(deleteCommand);

program
  .command('export [id]')
  .description('Export one or all prompts (omit ID to export all)')
  .option('-f, --format <format>', 'Output format: json | markdown | text', 'json')
  .option('--url <url>', 'API base URL', DEFAULT_URL)
  .action(exportCommand);

program.parse();
