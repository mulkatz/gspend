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

const { getCostStatus, getBreakdown, getHistory } = await import('./costs.js');

const testConfig: Config = {
	projects: [{ projectId: 'test-proj' }],
	bigquery: { projectId: 'test-proj', datasetId: 'billing_ds', tableId: 'gcp_billing_export' },
	currency: 'USD',
	pollInterval: 300,
};

describe('getCostStatus', () => {
	it('returns cached result if available', async () => {
		const cached = { today: 5, thisMonth: 100 };
		mockGetCached.mockReturnValue(cached);

		const result = await getCostStatus(testConfig);
		expect(result).toBe(cached);
	});

	it('fetches from BigQuery on cache miss', async () => {
		mockGetCached.mockReturnValue(null);
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
