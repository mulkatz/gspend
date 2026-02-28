import { describe, expect, it } from 'vitest';
import { barChart, budgetGauge } from './chart.js';

describe('barChart', () => {
	it('returns "No data" for empty items', () => {
		expect(barChart([])).toContain('No data');
	});

	it('returns "No costs" when all values are zero', () => {
		const items = [
			{ label: 'day1', value: 0 },
			{ label: 'day2', value: 0 },
		];
		expect(barChart(items)).toContain('No costs');
	});

	it('renders bars for positive values', () => {
		const items = [
			{ label: '2026-02-01', value: 10 },
			{ label: '2026-02-02', value: 5 },
			{ label: '2026-02-03', value: 20 },
		];
		const result = barChart(items, 20);
		expect(result).toContain('2026-02-01');
		expect(result).toContain('2026-02-02');
		expect(result).toContain('2026-02-03');
		expect(result.split('\n')).toHaveLength(3);
	});
});

describe('budgetGauge', () => {
	it('renders a gauge with filled and empty blocks', () => {
		const gauge = budgetGauge(50, 10);
		expect(gauge).toBeTruthy();
		expect(gauge.length).toBeGreaterThan(0);
	});

	it('handles 0%', () => {
		const gauge = budgetGauge(0, 10);
		expect(gauge).toBeTruthy();
	});

	it('handles 100%', () => {
		const gauge = budgetGauge(100, 10);
		expect(gauge).toBeTruthy();
	});

	it('handles over 100%', () => {
		const gauge = budgetGauge(150, 10);
		expect(gauge).toBeTruthy();
	});
});
