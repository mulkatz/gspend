import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { Config } from '../../config.js';
import { BarChart } from '../components/BarChart.js';
import { ErrorView } from '../components/ErrorView.js';
import { LoadingView } from '../components/LoadingView.js';
import { useHistoryData } from '../hooks/useHistoryData.js';

interface HistoryViewProps {
	config: Config;
	filterProjectId: string | undefined;
}

function fmt(amount: number, currency: string): string {
	const symbol = currency === 'EUR' ? '\u20AC' : '$';
	return `${symbol}${amount.toFixed(2)}`;
}

export function HistoryView({ config, filterProjectId }: HistoryViewProps): ReactNode {
	const { days, loading, error } = useHistoryData(config, filterProjectId, 14);

	if (loading) return <LoadingView message="Fetching history..." />;
	if (error) return <ErrorView message={error} />;
	if (days.length === 0) return <Text dimColor>No history data</Text>;

	const items = days.map((d) => ({
		label: d.date.slice(5), // MM-DD
		value: d.amount,
	}));

	const currency = days[0]?.currency ?? 'USD';
	const total = days.reduce((s, d) => s + d.amount, 0);
	const avg = total / days.length;

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>Daily Costs (last {days.length} days)</Text>
			<BarChart items={items} width={30} formatValue={(v) => fmt(v, currency)} />
			<Box gap={2}>
				<Text dimColor>Total: {fmt(total, currency)}</Text>
				<Text dimColor>Avg/day: {fmt(avg, currency)}</Text>
			</Box>
		</Box>
	);
}
