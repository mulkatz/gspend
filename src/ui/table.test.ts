import { describe, expect, it } from 'vitest';
import type { ServiceBreakdown, SkuBreakdown } from '../gcp/bigquery.js';
import type { CostStatus } from '../tracker/costs.js';
import { breakdownTable, projectsTable, statusTable } from './table.js';

const baseCostStatus: CostStatus = {
	today: 5.5,
	thisWeek: 25,
	thisMonth: 100,
	netMonth: 90,
	topServices: [
		{ service: 'Compute Engine', amount: 60, percentage: 60, currency: 'USD' },
		{ service: 'Cloud Storage', amount: 30, percentage: 30, currency: 'USD' },
	],
	trend: { direction: 'rising', percentChange: 15 },
	forecast: 200,
	currency: 'USD',
	dataFreshness: Date.now(),
};

describe('statusTable', () => {
	it('renders cost summary without budget', () => {
		const result = statusTable(baseCostStatus);
		expect(result).toContain('Today');
		expect(result).toContain('This Month');
		expect(result).toContain('Forecast');
		expect(result).toContain('Trend');
		expect(result).toContain('Top Services');
	});

	it('renders budget row when budget status provided', () => {
		const result = statusTable(baseCostStatus, {
			budget: 500,
			spent: 100,
			percentage: 20,
			remaining: 400,
			level: 'ok',
		});
		expect(result).toContain('Budget');
	});
});

describe('breakdownTable', () => {
	it('renders service-level breakdown', () => {
		const items: ServiceBreakdown[] = [
			{ service: 'Compute Engine', amount: 60, percentage: 60, currency: 'USD' },
			{ service: 'Cloud Storage', amount: 40, percentage: 40, currency: 'USD' },
		];
		const result = breakdownTable(items);
		expect(result).toContain('Compute Engine');
		expect(result).toContain('Cloud Storage');
		expect(result).toContain('Total');
	});

	it('renders SKU-level breakdown with descriptions', () => {
		const items: SkuBreakdown[] = [
			{ sku: 'sku-1', description: 'N1 vCPU', amount: 30, percentage: 75, currency: 'USD' },
			{ sku: 'sku-2', description: 'N1 RAM', amount: 10, percentage: 25, currency: 'USD' },
		];
		const result = breakdownTable(items);
		expect(result).toContain('sku-1');
		expect(result).toContain('N1 vCPU');
		expect(result).toContain('Total');
	});
});

describe('projectsTable', () => {
	it('renders project list with billing status', () => {
		const projects = [
			{
				projectId: 'my-project',
				displayName: 'My Project',
				billingAccountId: 'ABC-123',
				billingEnabled: true,
			},
			{
				projectId: 'other-proj',
				displayName: 'Other',
				billingAccountId: null,
				billingEnabled: false,
			},
		];
		const result = projectsTable(projects);
		expect(result).toContain('my-project');
		expect(result).toContain('other-proj');
		expect(result).toContain('ABC-123');
	});
});
