import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

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

function formatRelativeTime(date: Date): { text: string; stale: boolean } {
	const diff = Date.now() - date.getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	let relative: string;
	if (days > 0) relative = `${days}d ago`;
	else if (hours > 0) relative = `${hours}h ago`;
	else if (minutes > 0) relative = `${minutes}m ago`;
	else relative = 'just now';

	return { text: relative, stale: days >= 1 };
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
	const freshness = dataFreshness ? formatRelativeTime(dataFreshness) : null;

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box justifyContent="space-between">
				<Box gap={1}>
					<Text bold color="green">
						gspend
					</Text>
					<Text dimColor>{projectScope}</Text>
				</Box>
				{freshness &&
					(freshness.stale ? (
						<Text color="yellow">
							{'\u26A0'} Data: {freshness.text}
						</Text>
					) : (
						<Text dimColor>Data: {freshness.text}</Text>
					))}
			</Box>
			<Box gap={2} marginTop={1}>
				{tabs.map((tab, i) => (
					<TabLabel key={tab.key} tab={tab} index={i} isActive={activeTab === tab.key} />
				))}
			</Box>
		</Box>
	);
}
