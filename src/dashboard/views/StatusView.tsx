import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { Config } from '../../config.js';
import { BarChart } from '../components/BarChart.js';
import { BudgetGauge } from '../components/BudgetGauge.js';
import { ErrorView } from '../components/ErrorView.js';
import { LoadingView } from '../components/LoadingView.js';
import { TrendBadge } from '../components/TrendBadge.js';
import { useCostData } from '../hooks/useCostData.js';

interface StatusViewProps {
	config: Config;
	filterProjectId: string | undefined;
	onDataFreshness?: (date: Date) => void;
}

function fmt(amount: number, currency: string): string {
	const symbol = currency === 'EUR' ? '\u20AC' : '$';
	return `${symbol}${amount.toFixed(2)}`;
}

export function StatusView({
	config,
	filterProjectId,
	onDataFreshness,
}: StatusViewProps): ReactNode {
	const { status, budgets, loading, error } = useCostData(config, filterProjectId);

	useEffect(() => {
		if (status && onDataFreshness) {
			onDataFreshness(new Date(status.dataFreshness));
		}
	}, [status, onDataFreshness]);

	if (loading) return <LoadingView message="Fetching cost data..." />;
	if (error) return <ErrorView message={error} />;
	if (!status) return <Text dimColor>No data</Text>;

	const serviceItems = status.topServices.map((s) => ({
		label: s.service,
		value: s.amount,
	}));

	return (
		<Box flexDirection="column" gap={1}>
			<Box flexDirection="column">
				<Box gap={2}>
					<Text dimColor>{'Today'.padEnd(14)}</Text>
					<Text bold>{fmt(status.today, status.currency)}</Text>
				</Box>
				<Box gap={2}>
					<Text dimColor>{'This Week'.padEnd(14)}</Text>
					<Text bold>{fmt(status.thisWeek, status.currency)}</Text>
				</Box>
				<Box gap={2}>
					<Text dimColor>{'This Month'.padEnd(14)}</Text>
					<Text bold>{fmt(status.netMonth, status.currency)}</Text>
					<Text dimColor>(gross: {fmt(status.thisMonth, status.currency)})</Text>
				</Box>
				<Box gap={2}>
					<Text dimColor>{'Forecast'.padEnd(14)}</Text>
					<Text bold>{fmt(status.forecast, status.currency)}</Text>
					<Text dimColor>end of month</Text>
				</Box>
				<Box gap={2}>
					<Text dimColor>{'Trend'.padEnd(14)}</Text>
					<TrendBadge trend={status.trend} />
				</Box>
			</Box>

			{budgets.size > 0 && (
				<Box flexDirection="column">
					<Text bold>Budget</Text>
					{[...budgets.entries()].map(([projectId, bs]) => (
						<Box key={projectId} gap={1}>
							<Text dimColor>{projectId.padEnd(20)}</Text>
							<BudgetGauge budget={bs} currency={status.currency} />
						</Box>
					))}
				</Box>
			)}

			{serviceItems.length > 0 && (
				<Box flexDirection="column">
					<Text bold>Top Services</Text>
					<BarChart items={serviceItems} formatValue={(v) => fmt(v, status.currency)} />
				</Box>
			)}
		</Box>
	);
}
