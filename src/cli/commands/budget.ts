import chalk from 'chalk';
import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../config.js';
import { GspendError } from '../../errors.js';
import { getBudgetStatus } from '../../tracker/budget.js';
import { currency as formatCurrency } from '../../ui/colors.js';

export const budgetCommand = new Command('budget')
	.description('View or set monthly budget')
	.argument('[action]', '"set" to update budget')
	.argument('[amount]', 'Monthly budget amount')
	.option('--warn <percent>', 'Warning threshold percentage', '80')
	.action(async (action?: string, amount?: string, opts?: { warn: string }, cmd?: Command) => {
		const parentOpts = cmd?.parent?.opts() as { project?: string } | undefined;
		const filterProject = parentOpts?.project;

		try {
			const config = loadConfig();

			if (action === 'set' && amount) {
				const budgetAmount = Number.parseFloat(amount);
				if (Number.isNaN(budgetAmount) || budgetAmount <= 0) {
					console.error(chalk.red('Budget amount must be a positive number.'));
					process.exitCode = 1;
					return;
				}

				const warnPercent = Number.parseInt(opts?.warn ?? '80', 10);

				const targets = filterProject
					? config.projects.filter((p) => p.projectId === filterProject)
					: config.projects;

				if (targets.length === 0) {
					console.error(chalk.red(`Project "${filterProject}" not found in config.`));
					process.exitCode = 1;
					return;
				}

				for (const project of targets) {
					project.monthlyBudget = budgetAmount;
					project.budgetWarnPercent = warnPercent;
				}

				saveConfig(config);
				const scope = filterProject ?? 'all projects';
				console.log(
					chalk.green(
						`Budget set to ${formatCurrency(budgetAmount, config.currency)}/month for ${scope} (warn at ${warnPercent}%)`,
					),
				);
				return;
			}

			console.log(`\n${chalk.bold('Budget Configuration')}\n`);

			for (const project of config.projects) {
				if (!project.monthlyBudget) {
					console.log(`  ${chalk.cyan(project.projectId)}: ${chalk.dim('No budget set')}`);
					continue;
				}

				const status = getBudgetStatus(project, 0);
				if (!status) continue;

				console.log(
					`  ${chalk.cyan(project.projectId)}:`,
					`${formatCurrency(project.monthlyBudget, config.currency)}/month`,
					chalk.dim(`(warn at ${project.budgetWarnPercent ?? 80}%)`),
				);
			}

			console.log(`\n${chalk.dim('Run `gspend status` to see budget usage with live data.')}`);
			console.log(chalk.dim('Run `gspend budget set <amount>` to update the budget.'));
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
