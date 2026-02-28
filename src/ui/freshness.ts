import chalk from 'chalk';

export function formatFreshness(date: Date): string {
	const now = Date.now();
	const diff = now - date.getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	let relative: string;
	if (days > 0) relative = `${days} day${days > 1 ? 's' : ''} ago`;
	else if (hours > 0) relative = `${hours} hour${hours > 1 ? 's' : ''} ago`;
	else if (minutes > 0) relative = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
	else relative = 'just now';

	if (days >= 1) {
		return chalk.yellow(`\u26A0 Data from ${relative}`);
	}
	return chalk.dim(`Data from ${relative}`);
}

export function freshnessFooter(date: Date): string {
	return `\n${formatFreshness(date)}`;
}
