import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runMigrations } from './migrations.js';

let testDb: Database.Database;

vi.mock('./db.js', () => ({
	getDb: () => testDb,
}));

const { upsertCostEntries, getCostsByDateRange, getLatestDataTimestamp } = await import(
	'./history.js'
);

describe('history store', () => {
	beforeAll(() => {
		testDb = new Database(':memory:');
		testDb.pragma('journal_mode = WAL');
		testDb.pragma('foreign_keys = ON');
		runMigrations(testDb);
	});

	beforeEach(() => {
		testDb.prepare('DELETE FROM cost_entries').run();
	});

	afterAll(() => {
		testDb.close();
	});

	it('upsertCostEntries inserts and getCostsByDateRange retrieves', () => {
		upsertCostEntries([
			{
				projectId: 'proj-1',
				date: '2026-02-01',
				service: 'Compute Engine',
				sku: 'sku-1',
				description: 'vCPU',
				amount: 10.5,
				currency: 'USD',
			},
		]);

		const rows = getCostsByDateRange('proj-1', '2026-02-01', '2026-02-28');
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			projectId: 'proj-1',
			date: '2026-02-01',
			service: 'Compute Engine',
			sku: 'sku-1',
			description: 'vCPU',
			amount: 10.5,
			currency: 'USD',
		});
	});

	it('upsertCostEntries updates on conflict', () => {
		upsertCostEntries([
			{
				projectId: 'proj-1',
				date: '2026-02-01',
				service: 'Compute',
				sku: 'sku-1',
				description: 'v1',
				amount: 10,
				currency: 'USD',
			},
		]);

		upsertCostEntries([
			{
				projectId: 'proj-1',
				date: '2026-02-01',
				service: 'Compute',
				sku: 'sku-1',
				description: 'v2',
				amount: 20,
				currency: 'USD',
			},
		]);

		const rows = getCostsByDateRange('proj-1', '2026-02-01', '2026-02-28');
		expect(rows).toHaveLength(1);
		expect(rows[0]?.amount).toBe(20);
		expect(rows[0]?.description).toBe('v2');
	});

	it('getCostsByDateRange maps snake_case to camelCase', () => {
		upsertCostEntries([
			{
				projectId: 'my-proj',
				date: '2026-02-05',
				service: 'Storage',
				sku: 'sku-2',
				description: 'GCS',
				amount: 5,
				currency: 'EUR',
				usageQuantity: 100,
				usageUnit: 'GB',
			},
		]);

		const rows = getCostsByDateRange('my-proj', '2026-02-01', '2026-02-28');
		expect(rows[0]).toMatchObject({
			projectId: 'my-proj',
			usageQuantity: 100,
			usageUnit: 'GB',
		});
	});

	it('handles null usage fields gracefully', () => {
		upsertCostEntries([
			{
				projectId: 'proj-1',
				date: '2026-02-01',
				service: 'S1',
				sku: 'k1',
				description: 'desc',
				amount: 1,
				currency: 'USD',
			},
		]);

		const rows = getCostsByDateRange('proj-1', '2026-02-01', '2026-02-28');
		expect(rows[0]?.usageQuantity).toBeUndefined();
		expect(rows[0]?.usageUnit).toBeUndefined();
	});

	it('getCostsByDateRange filters by date range', () => {
		upsertCostEntries([
			{
				projectId: 'proj-1',
				date: '2026-02-01',
				service: 'S1',
				sku: 'k1',
				description: 'd',
				amount: 10,
				currency: 'USD',
			},
			{
				projectId: 'proj-1',
				date: '2026-02-05',
				service: 'S1',
				sku: 'k2',
				description: 'd',
				amount: 20,
				currency: 'USD',
			},
			{
				projectId: 'proj-1',
				date: '2026-02-10',
				service: 'S1',
				sku: 'k3',
				description: 'd',
				amount: 30,
				currency: 'USD',
			},
		]);

		const rows = getCostsByDateRange('proj-1', '2026-02-01', '2026-02-05');
		expect(rows).toHaveLength(2);
	});

	it('getLatestDataTimestamp returns null when no entries', () => {
		expect(getLatestDataTimestamp('proj-1')).toBeNull();
	});

	it('getLatestDataTimestamp returns latest fetched_at', () => {
		upsertCostEntries([
			{
				projectId: 'proj-1',
				date: '2026-02-01',
				service: 'S1',
				sku: 'k1',
				description: 'd',
				amount: 10,
				currency: 'USD',
			},
		]);

		const result = getLatestDataTimestamp('proj-1');
		expect(result).not.toBeNull();
		expect(typeof result).toBe('string');
	});
});
