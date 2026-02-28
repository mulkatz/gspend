import { useEffect, useState } from 'react';
import type { Config } from '../../config.js';
import type { DailyCost } from '../../gcp/bigquery.js';
import { getHistory } from '../../tracker/costs.js';

export interface HistoryData {
	days: DailyCost[];
	loading: boolean;
	error: string | null;
}

export function useHistoryData(
	config: Config,
	filterProjectId: string | undefined,
	numDays = 14,
): HistoryData {
	const [days, setDays] = useState<DailyCost[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetch(): Promise<void> {
			setLoading(true);
			setError(null);
			try {
				const data = await getHistory(config, numDays, filterProjectId);
				if (cancelled) return;
				setDays(data);
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
	}, [config, filterProjectId, numDays]);

	return { days, loading, error };
}
