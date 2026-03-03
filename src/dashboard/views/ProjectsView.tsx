import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Config } from '../../config.js';
import { addProjectToConfig } from '../../config.js';
import { openInBrowser } from '../../gcp/browser.js';
import { ErrorView } from '../components/ErrorView.js';
import { LoadingView } from '../components/LoadingView.js';
import type { ProjectInfo } from '../hooks/useProjectsData.js';
import { useProjectsData } from '../hooks/useProjectsData.js';

interface ProjectsViewProps {
	config: Config;
	onConfigChange: (config: Config) => void;
}

export function ProjectsView({ config, onConfigChange }: ProjectsViewProps): ReactNode {
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const { projects, trackedCount, untrackedCount, otherAccountCount, loading, error } =
		useProjectsData(config, refreshTrigger);

	const tracked = useMemo(() => projects.filter((p) => p.tracked), [projects]);
	const untracked = useMemo(() => projects.filter((p) => !p.tracked && p.canTrack), [projects]);
	const otherAccount = useMemo(() => projects.filter((p) => !p.tracked && !p.canTrack), [projects]);

	// Navigable items: untracked first, then otherAccount
	const navigable = useMemo(() => [...untracked, ...otherAccount], [untracked, otherAccount]);

	// Clamp selection when navigable list shrinks (e.g. after adding a project)
	useEffect(() => {
		setSelectedIndex((prev) => Math.min(prev, Math.max(0, navigable.length - 1)));
	}, [navigable.length]);

	const handleAdd = useCallback(
		(project: ProjectInfo) => {
			const addPayload: { projectId: string; displayName?: string; billingAccountId?: string } = {
				projectId: project.projectId,
			};
			if (project.displayName) addPayload.displayName = project.displayName;
			if (project.billingAccountId) addPayload.billingAccountId = project.billingAccountId;
			const updated = addProjectToConfig(config, addPayload);
			onConfigChange(updated);
			setStatusMessage(`Added ${project.projectId}`);
			setTimeout(() => setStatusMessage(null), 2000);
		},
		[config, onConfigChange],
	);

	const handleOpenBillingExport = useCallback(
		(project: ProjectInfo) => {
			if (!project.billingAccountId) return;
			const url = `https://console.cloud.google.com/billing/${project.billingAccountId}/export`;
			openInBrowser(url);

			const dataset = config.bigquery.datasetId;
			const bqProject = config.bigquery.projectId;
			if (dataset) {
				setStatusMessage(
					`Opened browser. Select project "${bqProject}", dataset "${dataset}" on the export page. Press r after setup.`,
				);
			} else {
				setStatusMessage(
					`Opened browser. Create a dataset (e.g. "billing_export") and enable export. Press r after setup.`,
				);
			}
		},
		[config],
	);

	useInput((input, key) => {
		if (input === 'r') {
			setRefreshTrigger((n) => n + 1);
			setSelectedIndex(0);
			setStatusMessage(null);
			return;
		}

		if (navigable.length === 0) return;

		if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(prev + 1, navigable.length - 1));
		} else if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(prev - 1, 0));
		} else if (key.return) {
			const item = navigable[selectedIndex];
			if (!item) return;
			if (item.canTrack) {
				handleAdd(item);
			} else {
				handleOpenBillingExport(item);
			}
		}
	});

	if (loading) return <LoadingView message="Discovering GCP projects..." />;
	if (error) return <ErrorView message={error} />;

	return (
		<Box flexDirection="column" gap={1}>
			<Box justifyContent="space-between">
				<Text bold>Projects</Text>
				<Text dimColor>
					{trackedCount} tracked · {untrackedCount + otherAccountCount} untracked
				</Text>
			</Box>

			{tracked.length > 0 && (
				<Box flexDirection="column">
					<Text dimColor bold>
						Tracked
					</Text>
					{tracked.map((p) => (
						<Box key={p.projectId} gap={1}>
							<Text dimColor>
								{'  '}
								{'\u2713'} {p.projectId.padEnd(24).slice(0, 24)}
							</Text>
							<Text dimColor>{p.displayName}</Text>
						</Box>
					))}
				</Box>
			)}

			{untracked.length > 0 && (
				<Box flexDirection="column">
					<Text bold>Untracked</Text>
					{untracked.map((p, i) => {
						const isSelected = i === selectedIndex;
						return (
							<Box key={p.projectId} gap={1}>
								{isSelected ? <Text color="cyan">{'\u25B8'}</Text> : <Text> </Text>}
								{isSelected ? (
									<Text color="cyan">
										{'\u25CB'} {p.projectId.padEnd(24).slice(0, 24)}
									</Text>
								) : (
									<Text>
										{'\u25CB'} {p.projectId.padEnd(24).slice(0, 24)}
									</Text>
								)}
								<Text dimColor>{p.displayName}</Text>
							</Box>
						);
					})}
				</Box>
			)}

			{otherAccount.length > 0 && (
				<Box flexDirection="column">
					<Text dimColor bold>
						Other Billing Accounts (cannot track yet)
					</Text>
					{otherAccount.map((p, i) => {
						const navIdx = untracked.length + i;
						const isSelected = navIdx === selectedIndex;
						return (
							<Box key={p.projectId} gap={1}>
								{isSelected ? <Text color="yellow">{'\u25B8'}</Text> : <Text> </Text>}
								{isSelected ? (
									<Text color="yellow">
										{'\u00B7'} {p.projectId.padEnd(24).slice(0, 24)}
									</Text>
								) : (
									<Text dimColor>
										{'\u00B7'} {p.projectId.padEnd(24).slice(0, 24)}
									</Text>
								)}
								<Text dimColor>{p.displayName}</Text>
								{p.billingAccountId && <Text dimColor>acct: {p.billingAccountId}</Text>}
							</Box>
						);
					})}
				</Box>
			)}

			{projects.length === 0 && <Text dimColor>No GCP projects found</Text>}

			{statusMessage && <Text color="green">{statusMessage}</Text>}
		</Box>
	);
}
