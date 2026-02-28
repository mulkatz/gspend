import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Config } from '../../config.js';
import type { ServiceBreakdown, SkuBreakdown } from '../../gcp/bigquery.js';
import { ErrorView } from '../components/ErrorView.js';
import { LoadingView } from '../components/LoadingView.js';
import { useBreakdownData } from '../hooks/useBreakdownData.js';

interface BreakdownViewProps {
	config: Config;
	filterProjectId: string | undefined;
}

function isServiceBreakdown(item: ServiceBreakdown | SkuBreakdown): item is ServiceBreakdown {
	return 'service' in item;
}

function fmt(amount: number, currency: string): string {
	const symbol = currency === 'EUR' ? '\u20AC' : '$';
	return `${symbol}${amount.toFixed(2)}`;
}

export function BreakdownView({ config, filterProjectId }: BreakdownViewProps): ReactNode {
	const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
	const [selectedIndex, setSelectedIndex] = useState(0);

	const { result, loading, error } = useBreakdownData(
		config,
		filterProjectId,
		selectedService,
		undefined,
	);

	useInput((_input, key) => {
		if (!result) return;
		const len = result.items.length;
		if (len === 0) return;

		if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(prev + 1, len - 1));
		} else if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(prev - 1, 0));
		} else if (key.return && !selectedService) {
			const item = result.items[selectedIndex];
			if (item && isServiceBreakdown(item)) {
				setSelectedService(item.service);
				setSelectedIndex(0);
			}
		} else if (key.escape && selectedService) {
			setSelectedService(undefined);
			setSelectedIndex(0);
		}
	});

	if (loading) return <LoadingView message="Fetching breakdown..." />;
	if (error) return <ErrorView message={error} />;
	if (!result || result.items.length === 0) return <Text dimColor>No breakdown data</Text>;

	const title = selectedService
		? `Cost Breakdown: ${selectedService}`
		: `Cost Breakdown by Service (${result.month})`;

	const items = result.items.map((item) => ({
		label: isServiceBreakdown(item) ? item.service : `${item.sku} - ${item.description}`,
		value: item.amount,
	}));

	const maxValue = Math.max(...items.map((it) => it.value));

	return (
		<Box flexDirection="column" gap={1}>
			<Box gap={1}>
				<Text bold>{title}</Text>
				{selectedService && <Text dimColor>(Esc to go back)</Text>}
				{!selectedService && <Text dimColor>(Enter to drill into service)</Text>}
			</Box>
			<Box flexDirection="column">
				{items.map((item, i) => {
					const barLen = maxValue > 0 ? Math.round((item.value / maxValue) * 20) : 0;
					const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(20 - barLen);
					const pct = maxValue > 0 ? ((item.value / maxValue) * 100).toFixed(0) : '0';
					const isSelected = i === selectedIndex;

					return (
						<Box key={item.label} gap={1}>
							{isSelected ? <Text color="cyan">{'\u25B8'}</Text> : <Text> </Text>}
							<Text dimColor>{item.label.padEnd(30).slice(0, 30)}</Text>
							<Text color="cyan">{bar}</Text>
							<Text>{fmt(item.value, result.currency)}</Text>
							<Text dimColor>{pct.padStart(3)}%</Text>
						</Box>
					);
				})}
			</Box>
			<Box>
				<Text dimColor>
					Total:{' '}
					{fmt(
						result.items.reduce((s, it) => s + it.amount, 0),
						result.currency,
					)}
				</Text>
			</Box>
		</Box>
	);
}
