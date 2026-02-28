import chalk from 'chalk';
import { budgetColor, currency as formatCurrency } from './colors.js';

export interface BarItem {
	label: string;
	value: number;
}

export function barChart(items: BarItem[], width = 30, currencyCode = 'USD'): string {
	if (items.length === 0) return chalk.dim('  No data');

	const maxValue = Math.max(...items.map((i) => i.value));
	if (maxValue === 0) return chalk.dim('  No costs recorded');

	const maxLabelLen = Math.max(...items.map((i) => i.label.length));
	const maxAmountStr = formatCurrency(maxValue, currencyCode);
	const amountWidth = maxAmountStr.length;

	const lines: string[] = [];

	for (const item of items) {
		const barLen = maxValue > 0 ? Math.round((item.value / maxValue) * width) : 0;
		const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(width - barLen);
		const label = item.label.padEnd(maxLabelLen);
		const amount = formatCurrency(item.value, currencyCode).padStart(amountWidth);
		const pct = maxValue > 0 ? ((item.value / maxValue) * 100).toFixed(0) : '0';

		lines.push(`  ${chalk.dim(label)}  ${chalk.cyan(bar)}  ${amount}  ${chalk.dim(`${pct}%`)}`);
	}

	return lines.join('\n');
}

export function budgetGauge(percent: number, width = 20): string {
	const filled = Math.min(Math.round((percent / 100) * width), width);
	const empty = width - filled;
	const color = budgetColor(percent);
	return color('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(empty));
}
