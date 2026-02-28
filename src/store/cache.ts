import { getDb } from './db.js';

export const DEFAULT_TTL = {
	status: 900,
	breakdown: 3600,
	history: 86400,
} as const;

export function getCached<T>(key: string): T | null {
	const db = getDb();
	const row = db
		.prepare(
			`SELECT data_json, fetched_at, ttl_seconds FROM cache_meta
			 WHERE key = ?
			 AND datetime(fetched_at, '+' || ttl_seconds || ' seconds') > datetime('now')`,
		)
		.get(key) as { data_json: string } | undefined;

	if (!row) return null;
	return JSON.parse(row.data_json) as T;
}

export function setCache(key: string, data: unknown, ttlSeconds: number): void {
	const db = getDb();
	db.prepare(
		`INSERT OR REPLACE INTO cache_meta (key, data_json, fetched_at, ttl_seconds)
		 VALUES (?, ?, datetime('now'), ?)`,
	).run(key, JSON.stringify(data), ttlSeconds);
}

export function clearCache(keyPrefix?: string): void {
	const db = getDb();
	if (keyPrefix) {
		db.prepare('DELETE FROM cache_meta WHERE key LIKE ?').run(`${keyPrefix}%`);
	} else {
		db.prepare('DELETE FROM cache_meta').run();
	}
}
