export interface SqliteDatabase {
	prepare(sql: string): SqliteStatement;
	exec(sql: string): void;
	pragma(source: string, options?: { simple: true }): unknown;
	// biome-ignore lint/suspicious/noExplicitAny: generic callback requires any
	transaction<F extends (...args: any[]) => any>(fn: F): F;
	close(): void;
}

export interface SqliteStatement {
	run(...params: unknown[]): { changes: number };
	get(...params: unknown[]): unknown;
	all(...params: unknown[]): unknown[];
}
