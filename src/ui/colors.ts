import chalk from 'chalk';

export function budgetColor(percent: number): typeof chalk {
	if (percent >= 100) return chalk.red.bold;
	if (percent >= 80) return chalk.red;
	if (percent >= 50) return chalk.yellow;
	return chalk.green;
}

export function trendIcon(direction: 'rising' | 'stable' | 'falling'): string {
	switch (direction) {
		case 'rising':
			return chalk.red('↗');
		case 'falling':
			return chalk.green('↘');
		case 'stable':
			return chalk.dim('→');
	}
}

export function currency(amount: number, code = 'USD'): string {
	const symbol = code === 'EUR' ? '€' : '$';
	const formatted = Math.abs(amount).toFixed(2);
	const prefix = amount < 0 ? '-' : '';
	return `${prefix}${symbol}${formatted}`;
}

export function percentStr(value: number): string {
	return `${value.toFixed(1)}%`;
}

export function projectScope(filterProjectId: string | undefined, totalProjects: number): string {
	if (filterProjectId) return chalk.dim(`(project: ${filterProjectId})`);
	return chalk.dim(`(${totalProjects} project${totalProjects === 1 ? '' : 's'})`);
}

export const dim = chalk.dim;
export const bold = chalk.bold;
export const green = chalk.green;
export const yellow = chalk.yellow;
export const red = chalk.red;
export const cyan = chalk.cyan;
