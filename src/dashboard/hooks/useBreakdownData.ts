import { useEffect, useState } from 'react';
import type { Config } from '../../config.js';
import { type BreakdownResult, getBreakdown } from '../../tracker/costs.js';

export interface BreakdownData {
	result: BreakdownResult | null;
	loading: boolean;
	error: string | null;
}

export function useBreakdownData(
	config: Config,
	filterProjectId: string | undefined,
	service: string | undefined,
	month: string | undefined,
): BreakdownData {
	const [result, setResult] = useState<BreakdownResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetch(): Promise<void> {
			setLoading(true);
			setError(null);
			try {
				const data = await getBreakdown(config, service, month, filterProjectId);
				if (cancelled) return;
				setResult(data);
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
	}, [config, filterProjectId, service, month]);

	return { result, loading, error };
}
