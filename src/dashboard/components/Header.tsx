import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { formatFreshness } from '../../ui/freshness.js';

interface Tab {
	label: string;
	key: string;
}

interface HeaderProps {
	tabs: Tab[];
	activeTab: string;
	projectScope: string;
	dataFreshness: Date | null;
}

function TabLabel({
	tab,
	index,
	isActive,
}: {
	tab: Tab;
	index: number;
	isActive: boolean;
}): ReactNode {
	const prefix = isActive ? '\u25B8 ' : '  ';
	if (isActive) {
		return (
			<Text bold color="cyan">
				{prefix}
				{tab.label} <Text dimColor>{index + 1}</Text>
			</Text>
		);
	}
	return (
		<Text dimColor>
			{prefix}
			{tab.label} {index + 1}
		</Text>
	);
}

export function Header({ tabs, activeTab, projectScope, dataFreshness }: HeaderProps): ReactNode {
	const freshness = dataFreshness ? formatFreshness(dataFreshness) : '';

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box justifyContent="space-between">
				<Box gap={1}>
					<Text bold color="green">
						gspend
					</Text>
					<Text dimColor>{projectScope}</Text>
				</Box>
				{dataFreshness && <Text dimColor>Data: {freshness}</Text>}
			</Box>
			<Box gap={2} marginTop={1}>
				{tabs.map((tab, i) => (
					<TabLabel key={tab.key} tab={tab} index={i} isActive={activeTab === tab.key} />
				))}
			</Box>
		</Box>
	);
}
