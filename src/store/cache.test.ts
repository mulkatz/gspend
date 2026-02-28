import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrations.js';

let testDb: Database.Database;

describe('cache logic', () => {
	beforeAll(() => {
		testDb = new Database(':memory:');
		testDb.pragma('journal_mode = WAL');
		testDb.pragma('foreign_keys = ON');
		runMigrations(testDb);
	});

	afterAll(() => {
		testDb.close();
	});

	it('creates cache_meta table', () => {
		const tables = testDb
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_meta'")
			.all();
		expect(tables).toHaveLength(1);
	});

	it('inserts and retrieves cache entries', () => {
		testDb
			.prepare(
				`INSERT INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
				 VALUES (?, ?, datetime('now'), ?)`,
			)
			.run('test-key', JSON.stringify({ foo: 'bar' }), 3600);

		const row = testDb
			.prepare('SELECT data_json FROM cache_meta WHERE key = ?')
			.get('test-key') as { data_json: string };

		expect(JSON.parse(row.data_json)).toEqual({ foo: 'bar' });
	});

	it('replaces existing cache entries', () => {
		testDb
			.prepare(
				`INSERT OR REPLACE INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
				 VALUES (?, ?, datetime('now'), ?)`,
			)
			.run('test-key', JSON.stringify({ foo: 'updated' }), 3600);

		const rows = testDb.prepare('SELECT * FROM cache_meta WHERE key = ?').all('test-key');
		expect(rows).toHaveLength(1);
	});

	it('expires entries based on TTL', () => {
		// Insert with past timestamp (already expired)
		testDb
			.prepare(
				`INSERT OR REPLACE INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
				 VALUES (?, ?, datetime('now', '-2 hours'), ?)`,
			)
			.run('expired-key', JSON.stringify({ old: true }), 3600);

		const row = testDb
			.prepare(
				`SELECT data_json FROM cache_meta
				 WHERE key = ?
				 AND datetime(fetched_at, '+' || ttl_seconds || ' seconds') > datetime('now')`,
			)
			.get('expired-key');

		expect(row).toBeUndefined();
	});

	it('clears entries by prefix', () => {
		testDb
			.prepare(
				`INSERT OR REPLACE INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
				 VALUES (?, ?, datetime('now'), ?)`,
			)
			.run('status:proj-1', JSON.stringify({}), 3600);

		testDb
			.prepare(
				`INSERT OR REPLACE INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
				 VALUES (?, ?, datetime('now'), ?)`,
			)
			.run('breakdown:proj-1', JSON.stringify({}), 3600);

		testDb.prepare('DELETE FROM cache_meta WHERE key LIKE ?').run('status:%');

		const remaining = testDb.prepare('SELECT key FROM cache_meta').all() as Array<{
			key: string;
		}>;
		const keys = remaining.map((r) => r.key);
		expect(keys).not.toContain('status:proj-1');
		expect(keys).toContain('breakdown:proj-1');
	});
});
