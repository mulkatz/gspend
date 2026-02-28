import { render } from 'ink';
import type { Config } from '../config.js';
import { App } from './App.js';

export function renderDashboard(
	config: Config,
	filterProject: string | undefined,
	refreshInterval = 300,
): void {
	const { waitUntilExit } = render(
		<App config={config} initialProject={filterProject} refreshInterval={refreshInterval} />,
	);

	waitUntilExit().catch((err: unknown) => {
		process.stderr.write(
			`\nDashboard error: ${err instanceof Error ? err.message : String(err)}\n`,
		);
		process.exitCode = 1;
	});
}
