import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';

const mockGetCached = vi.fn();
const mockSetCache = vi.fn();
const mockGetCurrentMonthCosts = vi.fn();
const mockGetCostsByService = vi.fn();
const mockGetCostsBySku = vi.fn();
const mockGetDailyCosts = vi.fn();
const mockGetDataFreshness = vi.fn();
const mockFindBillingExportTable = vi.fn();
const mockUpsertCostEntries = vi.fn();
const mockSaveConfig = vi.fn();

vi.mock('../store/cache.js', () => ({
	getCached: (...args: unknown[]) => mockGetCached(...args),
	setCache: (...args: unknown[]) => mockSetCache(...args),
	DEFAULT_TTL: { status: 900, breakdown: 3600, history: 86400 },
}));

vi.mock('../store/history.js', () => ({
	upsertCostEntries: (...args: unknown[]) => mockUpsertCostEntries(...args),
}));

vi.mock('../gcp/bigquery.js', () => ({
	getCurrentMonthCosts: (...args: unknown[]) => mockGetCurrentMonthCosts(...args),
	getCostsByService: (...args: unknown[]) => mockGetCostsByService(...args),
	getCostsBySku: (...args: unknown[]) => mockGetCostsBySku(...args),
	getDailyCosts: (...args: unknown[]) => mockGetDailyCosts(...args),
	getDataFreshness: (...args: unknown[]) => mockGetDataFreshness(...args),
	findBillingExportTable: (...args: unknown[]) => mockFindBillingExportTable(...args),
}));

vi.mock('../config.js', async (importOriginal) => {
	const orig = await importOriginal<typeof import('../config.js')>();
	return {
		...orig,
		saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
	};
});

const { getCostStatus, getBreakdown, getHistory, resolveBillingExport } = await import(
	'./costs.js'
);

const testConfig: Config = {
	projects: [{ projectId: 'test-proj' }],
	bigquery: { projectId: 'test-proj', datasetId: 'billing_ds', tableId: 'gcp_billing_export' },
	currency: 'USD',
	pollInterval: 300,
};

function setupBqMocks(): void {
	mockGetCurrentMonthCosts.mockResolvedValue({
		totalCost: 100,
		netCost: 90,
		currency: 'USD',
		dailyCosts: [{ date: '2026-02-01', amount: 10, currency: 'USD' }],
	});
	mockGetCostsByService.mockResolvedValue([
		{ service: 'Compute', amount: 60, percentage: 60, currency: 'USD' },
	]);
	mockGetDailyCosts.mockResolvedValue([]);
	mockGetDataFreshness.mockResolvedValue(new Date('2026-02-01T12:00:00Z'));
}

describe('getCostStatus', () => {
	it('returns cached result if available', async () => {
		const cached = { today: 5, thisMonth: 100 };
		mockGetCached.mockReturnValue(cached);

		const result = await getCostStatus(testConfig);
		expect(result).toBe(cached);
	});

	it('fetches from BigQuery on cache miss', async () => {
		mockGetCached.mockReturnValue(null);
		setupBqMocks();

		const result = await getCostStatus(testConfig);
		expect(result.thisMonth).toBe(100);
		expect(result.netMonth).toBe(90);
		expect(mockSetCache).toHaveBeenCalled();
		expect(mockUpsertCostEntries).toHaveBeenCalled();
	});
});

describe('getBreakdown', () => {
	it('delegates to service breakdown by default', async () => {
		mockGetCached.mockReturnValue(null);
		mockGetCostsByService.mockResolvedValue([
			{ service: 'Compute', amount: 50, percentage: 100, currency: 'USD' },
		]);

		const result = await getBreakdown(testConfig);
		expect(result.items).toHaveLength(1);
		expect(mockGetCostsByService).toHaveBeenCalled();
	});

	it('delegates to SKU breakdown when service specified', async () => {
		mockGetCached.mockReturnValue(null);
		mockGetCostsBySku.mockResolvedValue([
			{ sku: 'sku-1', description: 'vCPU', amount: 30, percentage: 100, currency: 'USD' },
		]);

		const result = await getBreakdown(testConfig, 'Compute Engine');
		expect(result.items).toHaveLength(1);
		expect(mockGetCostsBySku).toHaveBeenCalled();
	});
});

describe('getHistory', () => {
	it('returns cached result if available', async () => {
		const cached = [{ date: '2026-02-01', amount: 5, currency: 'USD' }];
		mockGetCached.mockReturnValue(cached);

		const result = await getHistory(testConfig);
		expect(result).toBe(cached);
	});

	it('fetches from BigQuery on cache miss', async () => {
		mockGetCached.mockReturnValue(null);
		mockGetDailyCosts.mockResolvedValue([
			{ date: '2026-02-01', amount: 10, currency: 'USD' },
			{ date: '2026-02-02', amount: 15, currency: 'USD' },
		]);

		const result = await getHistory(testConfig, 7);
		expect(result).toHaveLength(2);
		expect(mockSetCache).toHaveBeenCalled();
	});
});

describe('resolveBillingExport', () => {
	it('uses billingExports entry when project matches', async () => {
		const config: Config = {
			...testConfig,
			projects: [{ projectId: 'proj-a', billingAccountId: 'ACCT-1' }],
			billingExports: {
				'ACCT-1': { projectId: 'bq-proj', datasetId: 'ds', tableId: 'tbl', currency: 'EUR' },
			},
		};

		const resolved = await resolveBillingExport(config, 'proj-a');
		expect(resolved.projectId).toBe('bq-proj');
		expect(resolved.datasetId).toBe('ds');
		expect(resolved.table).toBe('tbl');
		expect(resolved.currency).toBe('EUR');
	});

	it('falls back to config.bigquery when no billingExport matches', async () => {
		const config: Config = {
			...testConfig,
			projects: [{ projectId: 'proj-a', billingAccountId: 'ACCT-1' }],
		};

		const resolved = await resolveBillingExport(config, 'proj-a');
		expect(resolved.projectId).toBe('test-proj');
		expect(resolved.datasetId).toBe('billing_ds');
		expect(resolved.table).toBe('gcp_billing_export');
		expect(resolved.currency).toBe('USD');
	});

	it('falls back when filterProjectId is not in config.projects', async () => {
		const resolved = await resolveBillingExport(testConfig, 'unknown-proj');
		expect(resolved.projectId).toBe('test-proj');
		expect(resolved.currency).toBe('USD');
	});

	it('falls back to config.bigquery when filterProjectId is undefined', async () => {
		const resolved = await resolveBillingExport(testConfig, undefined);
		expect(resolved.projectId).toBe('test-proj');
	});

	it('uses config.currency when billingExport has no currency', async () => {
		const config: Config = {
			...testConfig,
			projects: [{ projectId: 'proj-a', billingAccountId: 'ACCT-1' }],
			billingExports: {
				'ACCT-1': { projectId: 'bq-proj', datasetId: 'ds', tableId: 'tbl' },
			},
		};

		const resolved = await resolveBillingExport(config, 'proj-a');
		expect(resolved.currency).toBe('USD');
	});

	it('triggers lazy discovery for billingExport without tableId', async () => {
		mockFindBillingExportTable.mockResolvedValue('gcp_billing_export_v1_ABCDEF');
		const config: Config = {
			...testConfig,
			projects: [{ projectId: 'proj-a', billingAccountId: 'ACCT-1' }],
			billingExports: {
				'ACCT-1': { projectId: 'bq-proj', datasetId: 'ds' },
			},
		};

		const resolved = await resolveBillingExport(config, 'proj-a');
		expect(resolved.table).toBe('gcp_billing_export_v1_ABCDEF');
		expect(mockSaveConfig).toHaveBeenCalled();
	});
});

describe('multi-account aggregation', () => {
	it('aggregates costs across billing accounts for all-projects view', async () => {
		mockGetCached.mockReturnValue(null);

		const config: Config = {
			projects: [
				{ projectId: 'proj-a', billingAccountId: 'ACCT-1' },
				{ projectId: 'proj-b', billingAccountId: 'ACCT-2' },
			],
			bigquery: { projectId: 'proj-a', datasetId: 'ds_a', tableId: 'tbl_a' },
			billingExports: {
				'ACCT-2': { projectId: 'proj-b', datasetId: 'ds_b', tableId: 'tbl_b' },
			},
			currency: 'USD',
			pollInterval: 300,
		};

		mockGetCurrentMonthCosts
			.mockResolvedValueOnce({
				totalCost: 50,
				netCost: 45,
				currency: 'USD',
				dailyCosts: [{ date: '2026-03-01', amount: 5, currency: 'USD' }],
			})
			.mockResolvedValueOnce({
				totalCost: 30,
				netCost: 28,
				currency: 'USD',
				dailyCosts: [{ date: '2026-03-01', amount: 3, currency: 'USD' }],
			});

		mockGetCostsByService
			.mockResolvedValueOnce([{ service: 'Compute', amount: 40, percentage: 80, currency: 'USD' }])
			.mockResolvedValueOnce([
				{ service: 'Compute', amount: 20, percentage: 67, currency: 'USD' },
				{ service: 'Storage', amount: 10, percentage: 33, currency: 'USD' },
			]);

		mockGetDailyCosts.mockResolvedValue([]);
		mockGetDataFreshness.mockResolvedValue(new Date('2026-03-01T12:00:00Z'));

		const result = await getCostStatus(config, undefined);
		expect(result.thisMonth).toBe(80); // 50 + 30
		expect(result.netMonth).toBe(73); // 45 + 28
		expect(result.currency).toBe('USD');
	});

	it('excludes non-matching currencies and reports them', async () => {
		mockGetCached.mockReturnValue(null);

		const config: Config = {
			projects: [
				{ projectId: 'proj-usd', billingAccountId: 'ACCT-USD' },
				{ projectId: 'proj-eur', billingAccountId: 'ACCT-EUR' },
			],
			bigquery: { projectId: 'proj-usd', datasetId: 'ds', tableId: 'tbl' },
			billingExports: {
				'ACCT-EUR': {
					projectId: 'proj-eur',
					datasetId: 'ds_eur',
					tableId: 'tbl_eur',
					currency: 'EUR',
				},
			},
			currency: 'USD',
			pollInterval: 300,
		};

		mockGetCurrentMonthCosts.mockResolvedValue({
			totalCost: 100,
			netCost: 90,
			currency: 'USD',
			dailyCosts: [],
		});
		mockGetCostsByService.mockResolvedValue([]);
		mockGetDailyCosts.mockResolvedValue([]);
		mockGetDataFreshness.mockResolvedValue(new Date('2026-03-01T12:00:00Z'));

		const result = await getCostStatus(config, undefined);
		expect(result.excludedCurrencies).toEqual(['EUR']);
		expect(result.thisMonth).toBe(100); // Only USD account
	});
});
