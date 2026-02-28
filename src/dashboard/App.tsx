import { Box, useApp, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Config } from '../config.js';
import { Header } from './components/Header.js';
import { HelpBar } from './components/HelpBar.js';
import { useAutoRefresh } from './hooks/useAutoRefresh.js';
import { BreakdownView } from './views/BreakdownView.js';
import { BudgetView } from './views/BudgetView.js';
import { HistoryView } from './views/HistoryView.js';
import { StatusView } from './views/StatusView.js';

const TABS = [
	{ label: 'Status', key: 'status' },
	{ label: 'Breakdown', key: 'breakdown' },
	{ label: 'History', key: 'history' },
	{ label: 'Budget', key: 'budget' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface AppProps {
	config: Config;
	initialProject: string | undefined;
	refreshInterval: number;
}

export function App({ config, initialProject, refreshInterval }: AppProps): ReactNode {
	const { exit } = useApp();
	const [activeTab, setActiveTab] = useState<TabKey>('status');
	const [filterProject, setFilterProject] = useState(initialProject);
	const [refreshKey, setRefreshKey] = useState(0);
	const [dataFreshness, setDataFreshness] = useState<Date | null>(null);

	const handleRefresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const { countdown, refresh } = useAutoRefresh(refreshInterval, handleRefresh);

	const [projectCycleIndex, setProjectCycleIndex] = useState(-1);
	const projectOptions = [undefined, ...config.projects.map((p) => p.projectId)];

	useInput((input, key) => {
		// Tab switching
		if (input === '1') setActiveTab('status');
		else if (input === '2') setActiveTab('breakdown');
		else if (input === '3') setActiveTab('history');
		else if (input === '4') setActiveTab('budget');
		else if (key.tab && !key.shift) {
			setActiveTab((prev) => {
				const idx = TABS.findIndex((t) => t.key === prev);
				const next = TABS[(idx + 1) % TABS.length];
				return next ? next.key : prev;
			});
		} else if (key.tab && key.shift) {
			setActiveTab((prev) => {
				const idx = TABS.findIndex((t) => t.key === prev);
				const next = TABS[(idx - 1 + TABS.length) % TABS.length];
				return next ? next.key : prev;
			});
		}

		// Actions
		if (input === 'q') exit();
		if (input === 'r') refresh();
		if (input === 'p') {
			const nextIdx = (projectCycleIndex + 1) % projectOptions.length;
			setProjectCycleIndex(nextIdx);
			setFilterProject(projectOptions[nextIdx]);
		}
	});

	const scopeLabel = filterProject
		? `project: ${filterProject}`
		: `All Projects (${config.projects.length})`;

	const viewProps = useMemo(
		() => ({ config, filterProjectId: filterProject }),
		[config, filterProject],
	);

	const handleDataFreshness = useCallback((date: Date) => {
		setDataFreshness(date);
	}, []);

	return (
		<Box flexDirection="column" paddingX={1}>
			<Header
				tabs={[...TABS]}
				activeTab={activeTab}
				projectScope={scopeLabel}
				dataFreshness={dataFreshness}
			/>
			<Box minHeight={10}>
				{activeTab === 'status' && (
					<StatusView {...viewProps} key={refreshKey} onDataFreshness={handleDataFreshness} />
				)}
				{activeTab === 'breakdown' && <BreakdownView {...viewProps} key={refreshKey} />}
				{activeTab === 'history' && <HistoryView {...viewProps} key={refreshKey} />}
				{activeTab === 'budget' && <BudgetView {...viewProps} key={refreshKey} />}
			</Box>
			<HelpBar countdown={countdown} />
		</Box>
	);
}
