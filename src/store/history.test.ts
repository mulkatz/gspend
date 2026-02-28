import Database from 'better-sqlite3';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrations.js';

let testDb: Database.Database;

describe('history store logic', () => {
	beforeAll(() => {
		testDb = new Database(':memory:');
		testDb.pragma('journal_mode = WAL');
		testDb.pragma('foreign_keys = ON');
		runMigrations(testDb);
	});

	afterEach(() => {
		testDb.prepare('DELETE FROM cost_entries').run();
	});

	afterAll(() => {
		testDb.close();
	});

	it('inserts cost entries', () => {
		testDb
			.prepare(
				`INSERT INTO cost_entries (project_id, date, service, sku, description, amount, currency)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run('proj-1', '2026-02-01', 'Compute Engine', 'sku-1', 'vCPU', 10.5, 'USD');

		const rows = testDb.prepare('SELECT * FROM cost_entries').all();
		expect(rows).toHaveLength(1);
	});

	it('enforces unique constraint on (project_id, date, service, sku)', () => {
		const insert = testDb.prepare(
			`INSERT INTO cost_entries (project_id, date, service, sku, amount, currency)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		);

		insert.run('proj-1', '2026-02-01', 'Compute', 'sku-1', 10, 'USD');

		expect(() => insert.run('proj-1', '2026-02-01', 'Compute', 'sku-1', 20, 'USD')).toThrow();
	});

	it('supports upsert via ON CONFLICT', () => {
		const upsert = testDb.prepare(
			`INSERT INTO cost_entries (project_id, date, service, sku, amount, currency)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(project_id, date, service, sku)
			 DO UPDATE SET amount = excluded.amount`,
		);

		upsert.run('proj-1', '2026-02-01', 'Compute', 'sku-1', 10, 'USD');
		upsert.run('proj-1', '2026-02-01', 'Compute', 'sku-1', 20, 'USD');

		const row = testDb
			.prepare('SELECT amount FROM cost_entries WHERE project_id = ?')
			.get('proj-1') as { amount: number };

		expect(row.amount).toBe(20);
	});

	it('queries by date range', () => {
		const insert = testDb.prepare(
			`INSERT INTO cost_entries (project_id, date, service, sku, amount, currency)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		);

		insert.run('proj-1', '2026-02-01', 'S1', 'k1', 10, 'USD');
		insert.run('proj-1', '2026-02-05', 'S1', 'k1', 20, 'USD');
		insert.run('proj-1', '2026-02-10', 'S1', 'k1', 30, 'USD');

		const rows = testDb
			.prepare('SELECT * FROM cost_entries WHERE project_id = ? AND date >= ? AND date <= ?')
			.all('proj-1', '2026-02-01', '2026-02-05');

		expect(rows).toHaveLength(2);
	});
});
