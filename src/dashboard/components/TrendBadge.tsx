import { Text } from 'ink';
import type { ReactNode } from 'react';
import type { TrendResult } from '../../tracker/trend.js';

interface TrendBadgeProps {
	trend: TrendResult;
}

export function TrendBadge({ trend }: TrendBadgeProps): ReactNode {
	const icon =
		trend.direction === 'rising' ? '\u2197' : trend.direction === 'falling' ? '\u2198' : '\u2192';
	const sign = trend.percentChange > 0 ? '+' : '';

	if (trend.direction === 'rising') {
		return (
			<Text color="red">
				{icon} {sign}
				{trend.percentChange.toFixed(1)}% vs last week
			</Text>
		);
	}
	if (trend.direction === 'falling') {
		return (
			<Text color="green">
				{icon} {sign}
				{trend.percentChange.toFixed(1)}% vs last week
			</Text>
		);
	}
	return (
		<Text>
			{icon} {sign}
			{trend.percentChange.toFixed(1)}% vs last week
		</Text>
	);
}
