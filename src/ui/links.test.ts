import { describe, expect, it } from 'vitest';
import { billingExportUrl, terminalLink } from './links.js';

describe('billingExportUrl', () => {
	it('generates correct billing export URL', () => {
		const url = billingExportUrl('01A2B3-C4D5E6-F7890A');
		expect(url).toBe('https://console.cloud.google.com/billing/01A2B3-C4D5E6-F7890A/export');
	});

	it('strips billingAccounts/ prefix', () => {
		const url = billingExportUrl('billingAccounts/01A2B3-C4D5E6-F7890A');
		expect(url).toBe('https://console.cloud.google.com/billing/01A2B3-C4D5E6-F7890A/export');
	});
});

describe('terminalLink', () => {
	it('contains OSC 8 escape sequences', () => {
		const link = terminalLink('click me', 'https://example.com');
		expect(link).toContain('\x1B]8;;');
		expect(link).toContain('https://example.com');
		expect(link).toContain('click me');
	});
});
