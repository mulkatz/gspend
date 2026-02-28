import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrations.js';

describe('migrations', () => {
	let db: Database.Database;

	beforeAll(() => {
		db = new Database(':memory:');
	});

	afterAll(() => {
		db.close();
	});

	it('creates tables on first run', () => {
		runMigrations(db);

		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;

		const names = tables.map((t) => t.name);
		expect(names).toContain('cost_entries');
		expect(names).toContain('cache_meta');
	});

	it('sets user_version after migration', () => {
		const version = db.pragma('user_version', { simple: true });
		expect(version).toBeGreaterThan(0);
	});

	it('is idempotent (safe to run multiple times)', () => {
		expect(() => runMigrations(db)).not.toThrow();
	});

	it('creates indexes on cost_entries', () => {
		const indexes = db
			.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='cost_entries'")
			.all() as Array<{ name: string }>;

		const names = indexes.map((i) => i.name);
		expect(names).toContain('idx_cost_entries_date');
		expect(names).toContain('idx_cost_entries_service');
		expect(names).toContain('idx_cost_entries_project');
		expect(names).toContain('idx_cost_entries_unique');
	});
});
