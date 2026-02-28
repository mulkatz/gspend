#!/usr/bin/env node

import { Command } from 'commander';
import { breakdownCommand } from './commands/breakdown.js';
import { budgetCommand } from './commands/budget.js';
import { historyCommand } from './commands/history.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
	.name('gspend')
	.description("See what you've actually spent on GCP")
	.version('0.0.1')
	.option('--project <id>', 'Filter to a specific GCP project')
	.option('--json', 'Output as JSON');

program.addCommand(initCommand);
program.addCommand(statusCommand, { isDefault: true });
program.addCommand(breakdownCommand);
program.addCommand(historyCommand);
program.addCommand(budgetCommand);

program.parse();
