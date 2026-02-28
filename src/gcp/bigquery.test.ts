import { describe, expect, it, vi } from 'vitest';
import { BigQueryError } from '../errors.js';

const mockQuery = vi.fn();
const mockGetTables = vi.fn();
const mockGetDatasets = vi.fn();

vi.mock('@google-cloud/bigquery', () => ({
	BigQuery: class {
		query = mockQuery;
		dataset = () => ({ getTables: mockGetTables });
		getDatasets = mockGetDatasets;
	},
}));

const {
	findBillingExportTable,
	getCurrentMonthCosts,
	getCostsByService,
	getDailyCosts,
	discoverBillingExport,
} = await import('./bigquery.js');

describe('findBillingExportTable', () => {
	it('finds gcp_billing_export_v1_ table', async () => {
		mockGetTables.mockResolvedValue([
			[{ id: 'some_table' }, { id: 'gcp_billing_export_v1_ABC123' }],
		]);

		const result = await findBillingExportTable('proj', 'dataset');
		expect(result).toBe('gcp_billing_export_v1_ABC123');
	});

	it('returns null when no billing table found', async () => {
		mockGetTables.mockResolvedValue([[{ id: 'other_table' }]]);

		const result = await findBillingExportTable('proj', 'dataset');
		expect(result).toBeNull();
	});

	it('throws BigQueryError on API failure', async () => {
		mockGetTables.mockRejectedValue(new Error('access denied'));

		await expect(findBillingExportTable('proj', 'dataset')).rejects.toThrow(BigQueryError);
	});
});

describe('getCurrentMonthCosts', () => {
	it('aggregates daily costs into monthly summary', async () => {
		mockQuery.mockResolvedValue([
			[
				{ date: '2026-02-01', total_cost: 10, net_cost: 8 },
				{ date: '2026-02-02', total_cost: 15, net_cost: 12 },
			],
		]);

		const result = await getCurrentMonthCosts('proj', 'ds', 'table');
		expect(result.totalCost).toBe(25);
		expect(result.netCost).toBe(20);
		expect(result.dailyCosts).toHaveLength(2);
		expect(result.currency).toBe('USD');
	});

	it('throws BigQueryError on query failure', async () => {
		mockQuery.mockRejectedValue(new Error('query failed'));

		await expect(getCurrentMonthCosts('proj', 'ds', 'table')).rejects.toThrow(BigQueryError);
	});
});

describe('getCostsByService', () => {
	it('calculates percentages correctly', async () => {
		mockQuery.mockResolvedValue([
			[
				{ service: 'Compute Engine', amount: 75 },
				{ service: 'Cloud Storage', amount: 25 },
			],
		]);

		const result = await getCostsByService('proj', 'ds', 'table');
		expect(result).toHaveLength(2);
		expect(result[0]?.percentage).toBe(75);
		expect(result[1]?.percentage).toBe(25);
	});

	it('validates month format', async () => {
		await expect(getCostsByService('proj', 'ds', 'table', undefined, 'invalid')).rejects.toThrow(
			'YYYY-MM',
		);
	});
});

describe('getDailyCosts', () => {
	it('returns daily cost data', async () => {
		mockQuery.mockResolvedValue([
			[
				{ date: '2026-02-01', amount: 5 },
				{ date: '2026-02-02', amount: 8 },
			],
		]);

		const result = await getDailyCosts('proj', 'ds', 'table');
		expect(result).toHaveLength(2);
		expect(result[0]?.date).toBe('2026-02-01');
	});
});

describe('discoverBillingExport', () => {
	it('scans projects for billing export tables', async () => {
		mockGetDatasets.mockResolvedValue([[{ id: 'billing_ds' }]]);
		mockGetTables.mockResolvedValue([[{ id: 'gcp_billing_export_v1_XYZ' }]]);

		const result = await discoverBillingExport(['proj-1']);
		expect(result).toEqual({
			projectId: 'proj-1',
			datasetId: 'billing_ds',
			tableId: 'gcp_billing_export_v1_XYZ',
		});
	});

	it('returns null when no export found', async () => {
		mockGetDatasets.mockResolvedValue([[{ id: 'ds' }]]);
		mockGetTables.mockResolvedValue([[{ id: 'other_table' }]]);

		const result = await discoverBillingExport(['proj-1']);
		expect(result).toBeNull();
	});
});

describe('identifier validation', () => {
	it('rejects SQL injection in identifiers', async () => {
		await expect(getCurrentMonthCosts('proj; DROP TABLE--', 'ds', 'table')).rejects.toThrow(
			'disallowed characters',
		);
	});
});
