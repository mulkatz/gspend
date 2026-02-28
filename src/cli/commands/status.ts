import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config.js';
import { GspendError } from '../../errors.js';
import { getBudgetStatus } from '../../tracker/budget.js';
import { getCostStatus } from '../../tracker/costs.js';
import { freshnessFooter } from '../../ui/freshness.js';
import { statusTable } from '../../ui/table.js';

export const statusCommand = new Command('status')
	.description('Show current GCP spending overview')
	.action(async (_opts, cmd) => {
		const parentOpts = cmd.parent?.opts() as { project?: string; json?: boolean } | undefined;
		const filterProject = parentOpts?.project;
		const jsonOutput = parentOpts?.json ?? false;

		const spinner = ora('Fetching cost data...').start();

		try {
			const config = loadConfig();
			const status = await getCostStatus(config, filterProject);

			spinner.stop();

			if (jsonOutput) {
				console.log(JSON.stringify(status, null, 2));
				return;
			}

			const project = filterProject
				? config.projects.find((p) => p.projectId === filterProject)
				: undefined;

			const budget = project ? getBudgetStatus(project, status.netMonth) : null;

			console.log(`\n${chalk.bold('GCP Spending Overview')}\n`);
			console.log(statusTable(status, budget));
			console.log(freshnessFooter(new Date(status.dataFreshness)));
		} catch (error) {
			spinner.stop();
			if (error instanceof GspendError) {
				console.error(chalk.red(error.message));
				if (error.hint) console.error(chalk.dim(error.hint));
			} else {
				console.error(chalk.red(String(error)));
			}
			process.exitCode = 1;
		}
	});
