import type { DailyCost } from '../gcp/bigquery.js';

export interface TrendResult {
	direction: 'rising' | 'stable' | 'falling';
	percentChange: number;
}

export function detectTrend(dailyCosts: DailyCost[]): TrendResult {
	if (dailyCosts.length < 7) {
		return { direction: 'stable', percentChange: 0 };
	}

	// Compare last 7 days vs previous 7 days
	const recent = dailyCosts.slice(-7);
	const previous = dailyCosts.slice(-14, -7);

	if (previous.length === 0) {
		return { direction: 'stable', percentChange: 0 };
	}

	const recentAvg = recent.reduce((s, d) => s + d.amount, 0) / recent.length;
	const previousAvg = previous.reduce((s, d) => s + d.amount, 0) / previous.length;

	if (previousAvg === 0) {
		return recentAvg > 0
			? { direction: 'rising', percentChange: 100 }
			: { direction: 'stable', percentChange: 0 };
	}

	const percentChange = ((recentAvg - previousAvg) / previousAvg) * 100;

	let direction: TrendResult['direction'];
	if (percentChange > 10) direction = 'rising';
	else if (percentChange < -10) direction = 'falling';
	else direction = 'stable';

	return { direction, percentChange };
}
