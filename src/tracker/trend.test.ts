import { describe, expect, it } from 'vitest';
import type { DailyCost } from '../gcp/bigquery.js';
import { detectTrend } from './trend.js';

function makeDays(amounts: number[]): DailyCost[] {
	return amounts.map((amount, i) => ({
		date: `2026-02-${String(i + 1).padStart(2, '0')}`,
		amount,
		currency: 'USD',
	}));
}

describe('detectTrend', () => {
	it('returns stable for less than 7 days of data', () => {
		const result = detectTrend(makeDays([1, 2, 3]));
		expect(result.direction).toBe('stable');
		expect(result.percentChange).toBe(0);
	});

	it('detects rising trend when recent costs are higher', () => {
		const result = detectTrend(makeDays([1, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5]));
		expect(result.direction).toBe('rising');
		expect(result.percentChange).toBe(400);
	});

	it('detects falling trend when recent costs are lower', () => {
		const result = detectTrend(makeDays([10, 10, 10, 10, 10, 10, 10, 2, 2, 2, 2, 2, 2, 2]));
		expect(result.direction).toBe('falling');
		expect(result.percentChange).toBe(-80);
	});

	it('detects stable trend when costs are similar', () => {
		const result = detectTrend(makeDays([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]));
		expect(result.direction).toBe('stable');
		expect(result.percentChange).toBe(0);
	});

	it('handles previous period with zero costs', () => {
		const result = detectTrend(makeDays([0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5]));
		expect(result.direction).toBe('rising');
		expect(result.percentChange).toBe(100);
	});

	it('stays within 10% threshold for stable', () => {
		const result = detectTrend(makeDays([5, 5, 5, 5, 5, 5, 5, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3]));
		expect(result.direction).toBe('stable');
	});
});
