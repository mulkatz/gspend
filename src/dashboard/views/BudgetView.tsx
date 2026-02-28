import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { Config } from '../../config.js';
import { BudgetGauge } from '../components/BudgetGauge.js';
import { ErrorView } from '../components/ErrorView.js';
import { LoadingView } from '../components/LoadingView.js';
import { useCostData } from '../hooks/useCostData.js';

interface BudgetViewProps {
	config: Config;
	filterProjectId: string | undefined;
}

export function BudgetView({ config, filterProjectId }: BudgetViewProps): ReactNode {
	const { status, budgets, loading, error } = useCostData(config, filterProjectId);

	if (loading) return <LoadingView message="Fetching budget data..." />;
	if (error) return <ErrorView message={error} />;
	if (!status) return <Text dimColor>No data</Text>;

	const projectsWithBudget = config.projects.filter((p) => {
		if (filterProjectId && p.projectId !== filterProjectId) return false;
		return p.monthlyBudget !== undefined;
	});

	if (projectsWithBudget.length === 0) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Budget Status</Text>
				<Text dimColor>No budgets configured.</Text>
				<Text dimColor>Add monthlyBudget to project config to enable budget tracking.</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>Budget Status</Text>
			{projectsWithBudget.map((project) => {
				const bs = budgets.get(project.projectId);
				if (!bs) return null;

				return (
					<Box key={project.projectId} flexDirection="column">
						<Text>{project.displayName ?? project.projectId}</Text>
						<Box marginLeft={2}>
							<BudgetGauge budget={bs} currency={status.currency} width={30} />
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}
