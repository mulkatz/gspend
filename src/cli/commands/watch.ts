import chalk from 'chalk';
import { Command } from 'commander';
import { type Config, loadConfig } from '../../config.js';
import { GspendError } from '../../errors.js';
import { clearCache } from '../../store/cache.js';
import { closeDb } from '../../store/db.js';
import { getBudgetStatus } from '../../tracker/budget.js';
import { getCostStatus } from '../../tracker/costs.js';
import { freshnessFooter } from '../../ui/freshness.js';
import { statusTable } from '../../ui/table.js';

export const watchCommand = new Command('watch')
	.description('Live-updating cost display')
	.option('--interval <seconds>', 'Refresh interval in seconds', '300')
	.action(async (opts, cmd) => {
		const parentOpts = cmd.parent?.opts() as { project?: string } | undefined;
		const filterProject = parentOpts?.project;
		const intervalSec = Number.parseInt((opts as { interval: string }).interval, 10);

		if (Number.isNaN(intervalSec) || intervalSec <= 0) {
			console.error(chalk.red('--interval must be a positive integer (seconds).'));
			process.exitCode = 1;
			return;
		}

		const interval = intervalSec * 1000;

		let config: Config;
		try {
			config = loadConfig();
		} catch (error) {
			if (error instanceof GspendError) {
				console.error(chalk.red(error.message));
				if (error.hint) console.error(chalk.dim(error.hint));
			} else {
				console.error(chalk.red(String(error)));
			}
			process.exitCode = 1;
			return;
		}

		let running = true;
		let timer: ReturnType<typeof setTimeout> | null = null;

		process.once('SIGINT', () => {
			running = false;
			if (timer) clearTimeout(timer);
			console.log(chalk.dim('\nStopped.'));
		});

		async function refresh(): Promise<void> {
			try {
				clearCache('status:');

				const status = await getCostStatus(config, filterProject);

				process.stdout.write('\x1B[2J\x1B[H');

				const project = filterProject
					? config.projects.find((p) => p.projectId === filterProject)
					: undefined;

				const budget = project ? getBudgetStatus(project, status.netMonth) : null;

				console.log(
					`${chalk.bold('gspend watch')} ${chalk.dim(`(refreshing every ${interval / 1000}s)`)}\n`,
				);
				console.log(statusTable(status, budget));
				console.log(freshnessFooter(new Date(status.dataFreshness)));
				console.log(chalk.dim(`\nLast refresh: ${new Date().toLocaleTimeString()}`));
				console.log(chalk.dim('Press Ctrl+C to stop.'));
			} catch (error) {
				if (error instanceof GspendError) {
					console.error(chalk.red(error.message));
					if (error.hint) console.error(chalk.dim(error.hint));
				} else {
					console.error(chalk.red(String(error)));
				}
			}
		}

		try {
			await refresh();

			while (running) {
				await new Promise<void>((resolve) => {
					timer = setTimeout(resolve, interval);
				});
				if (running) await refresh();
			}
		} finally {
			closeDb();
		}
	});
