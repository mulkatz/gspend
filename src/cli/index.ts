#!/usr/bin/env node

import { Command } from 'commander';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
	.name('gspend')
	.description("See what you've actually spent on GCP")
	.version('0.0.1')
	.option('--project <id>', 'Filter to a specific GCP project')
	.option('--json', 'Output as JSON');

program.addCommand(statusCommand, { isDefault: true });

program.parse();
