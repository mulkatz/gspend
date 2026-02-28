import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runMigrations } from './migrations.js';

let testDb: Database.Database;

vi.mock('./db.js', () => ({
	getDb: () => testDb,
}));

const { getCached, setCache, clearCache } = await import('./cache.js');

describe('cache', () => {
	beforeAll(() => {
		testDb = new Database(':memory:');
		testDb.pragma('journal_mode = WAL');
		testDb.pragma('foreign_keys = ON');
		runMigrations(testDb);
	});

	beforeEach(() => {
		testDb.prepare('DELETE FROM cache_meta').run();
	});

	afterAll(() => {
		testDb.close();
	});

	it('getCached returns null on cache miss', () => {
		expect(getCached('nonexistent')).toBeNull();
	});

	it('setCache and getCached roundtrip', () => {
		setCache('test-key', { foo: 'bar' }, 3600);
		expect(getCached<{ foo: string }>('test-key')).toEqual({ foo: 'bar' });
	});

	it('setCache replaces existing entries', () => {
		setCache('key', { v: 1 }, 3600);
		setCache('key', { v: 2 }, 3600);
		expect(getCached<{ v: number }>('key')).toEqual({ v: 2 });
	});

	it('getCached returns null for expired entries', () => {
		// Insert with past timestamp to simulate expiry
		testDb
			.prepare(
				`INSERT OR REPLACE INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
				 VALUES (?, ?, datetime('now', '-2 hours'), ?)`,
			)
			.run('expired', JSON.stringify({ old: true }), 3600);

		expect(getCached('expired')).toBeNull();
	});

	it('clearCache() removes all entries', () => {
		setCache('a', 1, 3600);
		setCache('b', 2, 3600);
		clearCache();
		expect(getCached('a')).toBeNull();
		expect(getCached('b')).toBeNull();
	});

	it('clearCache with prefix removes only matching keys', () => {
		setCache('status:proj-1', { s: 1 }, 3600);
		setCache('breakdown:proj-1', { b: 1 }, 3600);
		clearCache('status:');
		expect(getCached('status:proj-1')).toBeNull();
		expect(getCached<{ b: number }>('breakdown:proj-1')).toEqual({ b: 1 });
	});
});
