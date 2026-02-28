import type Database from 'better-sqlite3';

type Migration = (db: Database.Database) => void;

const migrations: Migration[] = [
	// Migration 1: Initial schema
	(db) => {
		db.exec(`
			CREATE TABLE cost_entries (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id TEXT NOT NULL,
				date TEXT NOT NULL,
				service TEXT NOT NULL,
				sku TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				amount REAL NOT NULL,
				currency TEXT NOT NULL DEFAULT 'USD',
				usage_quantity REAL,
				usage_unit TEXT,
				fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE INDEX idx_cost_entries_date ON cost_entries(date);
			CREATE INDEX idx_cost_entries_service ON cost_entries(service);
			CREATE INDEX idx_cost_entries_project ON cost_entries(project_id);
			CREATE UNIQUE INDEX idx_cost_entries_unique
				ON cost_entries(project_id, date, service, sku);

			CREATE TABLE cache_meta (
				key TEXT PRIMARY KEY,
				data_json TEXT NOT NULL,
				fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
				ttl_seconds INTEGER NOT NULL DEFAULT 3600
			);
		`);
	},
];

export function runMigrations(db: Database.Database): void {
	const currentVersion = db.pragma('user_version', { simple: true }) as number;

	if (currentVersion >= migrations.length) return;

	const migrate = db.transaction(() => {
		for (let i = currentVersion; i < migrations.length; i++) {
			const migration = migrations[i];
			if (migration) {
				migration(db);
			}
		}
		db.pragma(`user_version = ${migrations.length}`);
	});

	migrate();
}
