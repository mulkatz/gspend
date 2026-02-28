import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config.js';
import { GspendError } from '../../errors.js';
import { getHistory } from '../../tracker/costs.js';
import { barChart } from '../../ui/chart.js';
import { currency as formatCurrency, projectScope } from '../../ui/colors.js';

export const historyCommand = new Command('history')
	.description('Show daily cost history as a bar chart')
	.option('--days <number>', 'Number of days to show', '14')
	.action(async (opts, cmd) => {
		const parentOpts = cmd.parent?.opts() as { project?: string; json?: boolean } | undefined;
		const filterProject = parentOpts?.project;
		const jsonOutput = parentOpts?.json ?? false;
		const days = Number.parseInt((opts as { days: string }).days, 10);

		if (Number.isNaN(days) || days <= 0) {
			console.error(chalk.red('--days must be a positive integer.'));
			process.exitCode = 1;
			return;
		}

		const spinner = ora('Fetching history...').start();

		try {
			const config = loadConfig();
			const dailyCosts = await getHistory(config, days, filterProject);

			spinner.stop();

			if (jsonOutput) {
				console.log(JSON.stringify(dailyCosts, null, 2));
				return;
			}

			const scope = projectScope(filterProject, config.projects.length);
			console.log(`\n${chalk.bold('Daily Costs')} ${scope} ${chalk.dim(`(last ${days} days)`)}\n`);

			if (dailyCosts.length === 0) {
				console.log(chalk.dim('  No cost data available.'));
				return;
			}

			const items = dailyCosts.map((d) => ({
				label: d.date,
				value: d.amount,
			}));

			const currency = dailyCosts[0]?.currency ?? 'USD';
			console.log(barChart(items, 30, currency));

			const total = dailyCosts.reduce((sum, d) => sum + d.amount, 0);
			const avg = total / dailyCosts.length;
			console.log(
				`\n  ${chalk.dim('Total:')} ${formatCurrency(total, currency)}  ${chalk.dim('Avg/day:')} ${formatCurrency(avg, currency)}`,
			);
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
