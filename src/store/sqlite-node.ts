import Database from 'better-sqlite3';
import type { SqliteDatabase } from './sqlite-interface.js';

export function createNodeDatabase(path: string): SqliteDatabase {
	return new Database(path) as unknown as SqliteDatabase;
}
