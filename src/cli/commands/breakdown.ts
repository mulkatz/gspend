import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config.js';
import { GspendError } from '../../errors.js';
import { getBreakdown } from '../../tracker/costs.js';
import { breakdownTable } from '../../ui/table.js';

export const breakdownCommand = new Command('breakdown')
	.description('Show cost breakdown by service or SKU')
	.option('--service <name>', 'Show SKU-level breakdown for a service')
	.option('--month <YYYY-MM>', 'Show breakdown for a specific month')
	.action(async (opts, cmd) => {
		const parentOpts = cmd.parent?.opts() as { project?: string; json?: boolean } | undefined;
		const filterProject = parentOpts?.project;
		const jsonOutput = parentOpts?.json ?? false;
		const { service, month } = opts as { service?: string; month?: string };

		const spinner = ora('Fetching breakdown...').start();

		try {
			const config = loadConfig();
			const result = await getBreakdown(config, service, month, filterProject);

			spinner.stop();

			if (jsonOutput) {
				console.log(JSON.stringify(result, null, 2));
				return;
			}

			const title = service ? `Cost Breakdown: ${service}` : 'Cost Breakdown by Service';
			const period = result.month;

			console.log(`\n${chalk.bold(title)} ${chalk.dim(`(${period})`)}\n`);
			console.log(breakdownTable(result.items));
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
