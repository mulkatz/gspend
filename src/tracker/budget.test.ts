import { describe, expect, it } from 'vitest';
import type { ProjectConfig } from '../config.js';
import { checkThresholds, getBudgetStatus } from './budget.js';

function makeProject(budget?: number | undefined): ProjectConfig {
	return {
		projectId: 'test-project',
		monthlyBudget: budget,
		budgetWarnPercent: 80,
	};
}

describe('getBudgetStatus', () => {
	it('returns null when no budget is set', () => {
		expect(getBudgetStatus(makeProject(), 100)).toBeNull();
	});

	it('returns ok when under 50%', () => {
		const status = getBudgetStatus(makeProject(100), 30);
		expect(status).not.toBeNull();
		expect(status?.level).toBe('ok');
		expect(status?.percentage).toBe(30);
		expect(status?.remaining).toBe(70);
	});

	it('returns warn when between 50-80%', () => {
		const status = getBudgetStatus(makeProject(100), 65);
		expect(status?.level).toBe('warn');
	});

	it('returns critical when between 80-100%', () => {
		const status = getBudgetStatus(makeProject(100), 90);
		expect(status?.level).toBe('critical');
	});

	it('returns exceeded when over 100%', () => {
		const status = getBudgetStatus(makeProject(100), 150);
		expect(status?.level).toBe('exceeded');
		expect(status?.remaining).toBe(-50);
	});
});

describe('checkThresholds', () => {
	it('returns empty when no budget is set', () => {
		expect(checkThresholds(makeProject(), 100)).toEqual([]);
	});

	it('returns no alerts when under first threshold', () => {
		expect(checkThresholds(makeProject(100), 30)).toEqual([]);
	});

	it('returns alert at 50% threshold', () => {
		const alerts = checkThresholds(makeProject(100), 55);
		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.threshold).toBe(50);
	});

	it('returns alerts at 50% and 80% thresholds', () => {
		const alerts = checkThresholds(makeProject(100), 85);
		expect(alerts).toHaveLength(2);
	});

	it('returns all alerts when budget exceeded', () => {
		const alerts = checkThresholds(makeProject(100), 110);
		expect(alerts).toHaveLength(3);
		expect(alerts[2]?.message).toContain('exceeded');
	});
});
