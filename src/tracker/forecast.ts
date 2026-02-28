import type { DailyCost } from '../gcp/bigquery.js';

export function forecastEndOfMonth(dailyCosts: DailyCost[]): number {
	if (dailyCosts.length < 2) return 0;

	// Use last 7 days for regression
	const recent = dailyCosts.slice(-7);
	if (recent.length < 2) return 0;

	// Simple linear regression
	const n = recent.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;

	for (let i = 0; i < n; i++) {
		const cost = recent[i];
		if (!cost) continue;
		sumX += i;
		sumY += cost.amount;
		sumXY += i * cost.amount;
		sumXX += i * i;
	}

	const denominator = n * sumXX - sumX * sumX;
	if (denominator === 0) return sumY; // all same x, return sum

	const slope = (n * sumXY - sumX * sumY) / denominator;
	const intercept = (sumY - slope * sumX) / n;

	// Calculate average daily cost from regression
	const avgDaily = intercept + slope * ((n - 1) / 2);
	if (avgDaily <= 0) return 0;

	// Days remaining in month
	const now = new Date();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const currentDay = now.getDate();
	const daysRemaining = daysInMonth - currentDay;

	// Current month total so far (from the billing data, sum all daily costs in current month)
	const currentMonthStr = now.toISOString().slice(0, 7);
	const monthTotal = dailyCosts
		.filter((d) => d.date.startsWith(currentMonthStr))
		.reduce((sum, d) => sum + d.amount, 0);

	// Forecast = current spend + projected remaining
	return monthTotal + avgDaily * daysRemaining;
}
