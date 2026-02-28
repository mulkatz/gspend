import { Command } from 'commander';
import { loadConfig } from '../../config.js';
import { GspendError } from '../../errors.js';

export const dashboardCommand = new Command('dashboard')
	.description('Interactive terminal dashboard')
	.option('--interval <seconds>', 'Auto-refresh interval in seconds', '300')
	.action(async (opts, cmd) => {
		const parentOpts = cmd.parent?.opts() as { project?: string } | undefined;
		const filterProject = parentOpts?.project;
		const intervalSec = Number.parseInt((opts as { interval: string }).interval, 10);

		try {
			const config = loadConfig();
			// Dynamic import — React/Ink only load when dashboard is used
			const { renderDashboard } = await import('../../dashboard/render.js');
			renderDashboard(config, filterProject, intervalSec);
		} catch (error) {
			if (error instanceof GspendError) {
				console.error(error.message);
				if (error.hint) console.error(error.hint);
			} else {
				console.error(String(error));
			}
			process.exitCode = 1;
		}
	});
