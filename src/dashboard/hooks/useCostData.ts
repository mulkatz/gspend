import { useEffect, useState } from 'react';
import type { Config } from '../../config.js';
import type { BudgetStatus } from '../../tracker/budget.js';
import { getBudgetStatus } from '../../tracker/budget.js';
import { type CostStatus, getCostStatus } from '../../tracker/costs.js';

export interface CostData {
	status: CostStatus | null;
	budgets: Map<string, BudgetStatus>;
	loading: boolean;
	error: string | null;
}

export function useCostData(config: Config, filterProjectId: string | undefined): CostData {
	const [status, setStatus] = useState<CostStatus | null>(null);
	const [budgets, setBudgets] = useState<Map<string, BudgetStatus>>(new Map());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetch(): Promise<void> {
			setLoading(true);
			setError(null);
			try {
				const result = await getCostStatus(config, filterProjectId);
				if (cancelled) return;
				setStatus(result);

				const budgetMap = new Map<string, BudgetStatus>();
				// Budget comparison is only accurate when filtering to a single project,
				// because netMonth is an aggregate across all queried projects.
				const budgetProjects = filterProjectId
					? config.projects.filter((p) => p.projectId === filterProjectId)
					: config.projects.length === 1
						? config.projects
						: [];
				for (const project of budgetProjects) {
					const bs = getBudgetStatus(project, result.netMonth);
					if (bs) budgetMap.set(project.projectId, bs);
				}
				setBudgets(budgetMap);
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void fetch();
		return () => {
			cancelled = true;
		};
	}, [config, filterProjectId]);

	return { status, budgets, loading, error };
}
