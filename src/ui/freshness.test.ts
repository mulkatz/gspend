import { describe, expect, it } from 'vitest';
import { formatFreshness } from './freshness.js';

describe('formatFreshness', () => {
	it('shows "just now" for recent timestamps', () => {
		const result = formatFreshness(new Date());
		expect(result).toContain('just now');
	});

	it('shows minutes ago', () => {
		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
		const result = formatFreshness(fiveMinAgo);
		expect(result).toContain('5 minutes ago');
	});

	it('shows hours ago', () => {
		const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
		const result = formatFreshness(threeHoursAgo);
		expect(result).toContain('3 hours ago');
	});

	it('shows days ago with warning', () => {
		const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
		const result = formatFreshness(twoDaysAgo);
		expect(result).toContain('2 days ago');
	});

	it('shows singular form for 1 hour', () => {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
		const result = formatFreshness(oneHourAgo);
		expect(result).toContain('1 hour ago');
	});
});
