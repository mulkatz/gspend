#!/usr/bin/env node

import { createRequire } from 'node:module';
import chalk from 'chalk';
import { Command } from 'commander';
import { loadConfig } from '../config.js';
import { GspendError } from '../errors.js';
import { initDb } from '../store/db.js';
import { getBudgetStatus } from '../tracker/budget.js';
import { getCostStatus } from '../tracker/costs.js';
import { projectScope } from '../ui/colors.js';
import { freshnessFooter } from '../ui/freshness.js';
import { statusTable } from '../ui/table.js';
import { breakdownCommand } from './commands/breakdown.js';
import { budgetCommand } from './commands/budget.js';
import { dashboardCommand } from './commands/dashboard.js';
import { historyCommand } from './commands/history.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { watchCommand } from './commands/watch.js';

// Version is injected by Bun at bundle time (__GSPEND_VERSION__),
// falling back to package.json for Node.js development
declare const __GSPEND_VERSION__: string | undefined;
const version =
	typeof __GSPEND_VERSION__ !== 'undefined'
		? __GSPEND_VERSION__
		: (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

const program = new Command();

program
	.name('gspend')
	.description("See what you've actually spent on GCP")
	.version(version)
	.option('--project <id>', 'Filter to a specific GCP project')
	.option('--json', 'Output as JSON');

program.hook('preAction', async () => {
	await initDb();
});

program.addCommand(initCommand);
program.addCommand(statusCommand);
program.addCommand(breakdownCommand);
program.addCommand(historyCommand);
program.addCommand(budgetCommand);
program.addCommand(watchCommand);
program.addCommand(dashboardCommand);

// Default action when no subcommand is provided:
// TTY → interactive dashboard, piped/--json → static status
program.action(async () => {
	const opts = program.opts() as { project?: string; json?: boolean };
	const isTTY = process.stdout.isTTY === true;

	try {
		if (isTTY && !opts.json) {
			const config = loadConfig();
			const { renderDashboard } = await import('../dashboard/render.js');
			renderDashboard(config, opts.project);
		} else {
			const config = loadConfig();
			const status = await getCostStatus(config, opts.project);

			if (opts.json) {
				console.log(JSON.stringify(status, null, 2));
				return;
			}

			const project = opts.project
				? config.projects.find((p) => p.projectId === opts.project)
				: undefined;
			const budget = project ? getBudgetStatus(project, status.netMonth) : null;
			const scope = projectScope(opts.project, config.projects.length);

			console.log(`\n${chalk.bold('GCP Spending Overview')} ${scope}\n`);
			console.log(statusTable(status, budget));
			console.log(freshnessFooter(new Date(status.dataFreshness)));
		}
	} catch (error) {
		if (error instanceof GspendError) {
			console.error(chalk.red(error.message));
			if (error.hint) console.error(chalk.dim(error.hint));
		} else {
			console.error(chalk.red(String(error)));
		}
		process.exitCode = 1;
	}
});

program.parse();
