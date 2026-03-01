import { ensurePaths, getDbPath } from '../paths.js';
import { runMigrations } from './migrations.js';
import type { SqliteDatabase } from './sqlite-interface.js';

let db: SqliteDatabase | null = null;
let createDatabase: ((path: string) => SqliteDatabase) | null = null;

export async function initDb(): Promise<void> {
	if (createDatabase) return;

	if (typeof Bun !== 'undefined') {
		const mod = await import('./sqlite-bun.js');
		createDatabase = mod.createBunDatabase;
	} else {
		const mod = await import('./sqlite-node.js');
		createDatabase = mod.createNodeDatabase;
	}
}

export function getDb(): SqliteDatabase {
	if (db) return db;
	if (!createDatabase) {
		throw new Error('Database not initialized. Call initDb() first.');
	}

	ensurePaths();
	db = createDatabase(getDbPath());

	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');

	runMigrations(db);
	return db;
}

export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}
