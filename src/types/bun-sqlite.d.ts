// Type declarations for Bun-specific APIs used in the binary build.
// These are only needed for TypeScript compilation — at runtime,
// Bun provides these natively.

declare var Bun: object | undefined;

declare module 'bun:sqlite' {
	export class Database {
		constructor(filename: string);
		prepare(sql: string): Statement;
		run(sql: string, ...params: unknown[]): { lastInsertRowid: number; changes: number };
		// biome-ignore lint/suspicious/noExplicitAny: generic callback requires any
		transaction<F extends (...args: any[]) => any>(fn: F): F;
		close(): void;
	}

	export class Statement {
		run(...params: unknown[]): { lastInsertRowid: number; changes: number };
		get(...params: unknown[]): unknown;
		all(...params: unknown[]): unknown[];
	}
}
