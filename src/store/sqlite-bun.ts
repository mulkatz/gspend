import { Database, type Statement } from 'bun:sqlite';
import type { SqliteDatabase, SqliteStatement } from './sqlite-interface.js';

class BunStatementAdapter implements SqliteStatement {
	constructor(private readonly stmt: Statement) {}

	run(...params: unknown[]): { changes: number } {
		return this.stmt.run(...params);
	}

	get(...params: unknown[]): unknown {
		return this.stmt.get(...params);
	}

	all(...params: unknown[]): unknown[] {
		return this.stmt.all(...params);
	}
}

class BunDatabaseAdapter implements SqliteDatabase {
	private readonly db: Database;

	constructor(path: string) {
		this.db = new Database(path);
	}

	prepare(sql: string): SqliteStatement {
		return new BunStatementAdapter(this.db.prepare(sql));
	}

	exec(sql: string): void {
		this.db.run(sql);
	}

	pragma(source: string, options?: { simple: true }): unknown {
		if (source.includes('=')) {
			this.db.run(`PRAGMA ${source}`);
			return undefined;
		}
		if (options?.simple) {
			const row = this.db.prepare(`PRAGMA ${source}`).get() as Record<string, unknown> | null;
			if (!row) return undefined;
			return Object.values(row)[0];
		}
		return this.db.prepare(`PRAGMA ${source}`).all();
	}

	// biome-ignore lint/suspicious/noExplicitAny: generic callback requires any
	transaction<F extends (...args: any[]) => any>(fn: F): F {
		return this.db.transaction(fn) as F;
	}

	close(): void {
		this.db.close();
	}
}

export function createBunDatabase(path: string): SqliteDatabase {
	return new BunDatabaseAdapter(path);
}
