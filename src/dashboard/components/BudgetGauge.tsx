import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { BudgetStatus } from '../../tracker/budget.js';

interface BudgetGaugeProps {
	budget: BudgetStatus;
	currency: string;
	width?: number;
}

const FILLED = '\u2588';
const EMPTY = '\u2591';

function levelColor(level: BudgetStatus['level']): string {
	switch (level) {
		case 'ok':
			return 'green';
		case 'warn':
			return 'yellow';
		case 'critical':
		case 'exceeded':
			return 'red';
	}
}

function formatCurrency(amount: number, code: string): string {
	const symbol = code === 'EUR' ? '\u20AC' : '$';
	return `${symbol}${amount.toFixed(2)}`;
}

export function BudgetGauge({ budget, currency, width = 20 }: BudgetGaugeProps): ReactNode {
	const filled = Math.min(Math.round((budget.percentage / 100) * width), width);
	const empty = width - filled;
	const color = levelColor(budget.level);

	return (
		<Box gap={1}>
			<Text color={color}>{FILLED.repeat(filled)}</Text>
			<Text dimColor>{EMPTY.repeat(empty)}</Text>
			<Text color={color}>{budget.percentage.toFixed(1)}%</Text>
			<Text dimColor>
				{formatCurrency(budget.spent, currency)} / {formatCurrency(budget.budget, currency)}
			</Text>
		</Box>
	);
}
