import { useEffect, useMemo, useState } from 'react';
import type { Config } from '../../config.js';
import type { ProjectWithBilling } from '../../gcp/projects.js';
import { discoverProjects } from '../../gcp/projects.js';

export interface ProjectInfo {
	projectId: string;
	displayName: string;
	billingAccountId: string | null;
	billingEnabled: boolean;
	tracked: boolean;
	canTrack: boolean;
}

export interface ProjectsData {
	projects: ProjectInfo[];
	trackedCount: number;
	untrackedCount: number;
	otherAccountCount: number;
	loading: boolean;
	error: string | null;
}

export function categorizeProjects(
	discovered: ProjectWithBilling[],
	config: Config,
): ProjectInfo[] {
	const trackedIds = new Set(config.projects.map((p) => p.projectId));

	// Billing accounts that tracked projects belong to — these have export available
	const trackedBillingAccounts = new Set<string>();
	for (const p of config.projects) {
		if (p.billingAccountId) {
			trackedBillingAccounts.add(p.billingAccountId);
		}
	}
	// Also check discovered projects that are tracked, in case config doesn't have billingAccountId
	for (const p of discovered) {
		if (trackedIds.has(p.projectId) && p.billingAccountId) {
			trackedBillingAccounts.add(p.billingAccountId);
		}
	}
	// Include billing accounts that have a billingExports entry (export already configured)
	if (config.billingExports) {
		for (const accountId of Object.keys(config.billingExports)) {
			trackedBillingAccounts.add(accountId);
		}
	}

	return discovered
		.filter((p) => p.billingEnabled)
		.map((p) => ({
			projectId: p.projectId,
			displayName: p.displayName,
			billingAccountId: p.billingAccountId,
			billingEnabled: p.billingEnabled,
			tracked: trackedIds.has(p.projectId),
			canTrack: p.billingAccountId !== null && trackedBillingAccounts.has(p.billingAccountId),
		}));
}

export function useProjectsData(config: Config, refreshTrigger: number): ProjectsData {
	const [discovered, setDiscovered] = useState<ProjectWithBilling[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshTrigger is an intentional re-fetch signal
	useEffect(() => {
		let cancelled = false;

		async function fetch(): Promise<void> {
			setLoading(true);
			setError(null);
			try {
				const result = await discoverProjects();
				if (cancelled) return;
				setDiscovered(result);
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
	}, [refreshTrigger]);

	// Re-categorize whenever discovered data or config changes (no API call)
	const projects = useMemo(() => categorizeProjects(discovered, config), [discovered, config]);

	const trackedCount = projects.filter((p) => p.tracked).length;
	const untrackedCount = projects.filter((p) => !p.tracked && p.canTrack).length;
	const otherAccountCount = projects.filter((p) => !p.tracked && !p.canTrack).length;

	return {
		projects,
		trackedCount,
		untrackedCount,
		otherAccountCount,
		loading,
		error,
	};
}
