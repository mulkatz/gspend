#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { breakdownCommand } from './commands/breakdown.js';
import { budgetCommand } from './commands/budget.js';
import { historyCommand } from './commands/history.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { watchCommand } from './commands/watch.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const program = new Command();

program
	.name('gspend')
	.description("See what you've actually spent on GCP")
	.version(pkg.version)
	.option('--project <id>', 'Filter to a specific GCP project')
	.option('--json', 'Output as JSON');

program.addCommand(initCommand);
program.addCommand(statusCommand, { isDefault: true });
program.addCommand(breakdownCommand);
program.addCommand(historyCommand);
program.addCommand(budgetCommand);
program.addCommand(watchCommand);

program.parse();
