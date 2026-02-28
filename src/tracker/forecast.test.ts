import { describe, expect, it } from 'vitest';
import type { DailyCost } from '../gcp/bigquery.js';
import { forecastEndOfMonth } from './forecast.js';

function makeDays(amounts: number[], startDay = 1): DailyCost[] {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	return amounts.map((amount, i) => ({
		date: `${year}-${String(month).padStart(2, '0')}-${String(startDay + i).padStart(2, '0')}`,
		amount,
		currency: 'USD',
	}));
}

describe('forecastEndOfMonth', () => {
	it('returns 0 for less than 2 days of data', () => {
		expect(forecastEndOfMonth([])).toBe(0);
		expect(forecastEndOfMonth(makeDays([5]))).toBe(0);
	});

	it('returns a positive forecast for consistent spending', () => {
		const costs = makeDays([10, 10, 10, 10, 10, 10, 10]);
		const forecast = forecastEndOfMonth(costs);
		expect(forecast).toBeGreaterThan(0);
	});

	it('forecast includes accumulated spend plus projected remaining', () => {
		const costs = makeDays([10, 10, 10, 10, 10, 10, 10]);
		const forecast = forecastEndOfMonth(costs);
		const totalSoFar = costs.reduce((s, c) => s + c.amount, 0);
		expect(forecast).toBeGreaterThanOrEqual(totalSoFar);
	});

	it('returns 0 when daily average is negative', () => {
		const costs = makeDays([-5, -5, -5, -5, -5, -5, -5]);
		expect(forecastEndOfMonth(costs)).toBe(0);
	});
});
