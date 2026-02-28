import Database from 'better-sqlite3';
import { ensurePaths, getDbPath } from '../paths.js';
import { runMigrations } from './migrations.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (db) return db;

	ensurePaths();
	db = new Database(getDbPath());

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
