import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface BarChartProps {
	items: { label: string; value: number }[];
	width?: number;
	formatValue?: (value: number) => string;
}

const FILLED = '\u2588';
const EMPTY = '\u2591';

export function BarChart({ items, width = 20, formatValue }: BarChartProps): ReactNode {
	if (items.length === 0) {
		return <Text dimColor>No data</Text>;
	}

	const maxValue = Math.max(...items.map((i) => i.value));
	const maxLabelLen = Math.max(...items.map((i) => i.label.length));
	const fmt = formatValue ?? ((v: number) => v.toFixed(2));

	return (
		<Box flexDirection="column">
			{items.map((item) => {
				const barLen = maxValue > 0 ? Math.round((item.value / maxValue) * width) : 0;
				const bar = FILLED.repeat(barLen) + EMPTY.repeat(width - barLen);
				const pct = maxValue > 0 ? ((item.value / maxValue) * 100).toFixed(0) : '0';

				return (
					<Box key={item.label} gap={1}>
						<Text dimColor>{item.label.padEnd(maxLabelLen)}</Text>
						<Text color="cyan">{bar}</Text>
						<Text>{fmt(item.value)}</Text>
						<Text dimColor>{pct.padStart(3)}%</Text>
					</Box>
				);
			})}
		</Box>
	);
}
