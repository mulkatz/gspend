import chalk from 'chalk';
import { describe, expect, it } from 'vitest';
import { budgetColor, currency, percentStr, trendIcon } from './colors.js';

describe('currency', () => {
	it('formats USD amounts', () => {
		expect(currency(12.34)).toBe('$12.34');
		expect(currency(0)).toBe('$0.00');
		expect(currency(1234.5)).toBe('$1234.50');
	});

	it('formats EUR amounts', () => {
		expect(currency(12.34, 'EUR')).toBe('€12.34');
	});

	it('handles negative amounts', () => {
		expect(currency(-5.5)).toBe('-$5.50');
	});
});

describe('trendIcon', () => {
	it('returns an icon for each direction', () => {
		expect(trendIcon('rising')).toContain('↗');
		expect(trendIcon('falling')).toContain('↘');
		expect(trendIcon('stable')).toContain('→');
	});
});

describe('budgetColor', () => {
	it('returns green below 50%', () => {
		const result = budgetColor(30);
		expect(result('test')).toBe(chalk.green('test'));
	});

	it('returns yellow at 50-79%', () => {
		const result = budgetColor(50);
		expect(result('test')).toBe(chalk.yellow('test'));
	});

	it('returns red at 80-99%', () => {
		const result = budgetColor(80);
		expect(result('test')).toBe(chalk.red('test'));
	});

	it('returns bold red at 100%+', () => {
		const result = budgetColor(100);
		expect(result('test')).toBe(chalk.red.bold('test'));
	});
});

describe('percentStr', () => {
	it('formats percentage with one decimal', () => {
		expect(percentStr(12.34)).toBe('12.3%');
		expect(percentStr(0)).toBe('0.0%');
		expect(percentStr(100)).toBe('100.0%');
	});
});
