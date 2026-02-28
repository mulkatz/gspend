import { getDb } from './db.js';

export interface CostEntry {
	projectId: string;
	date: string;
	service: string;
	sku: string;
	description: string;
	amount: number;
	currency: string;
	usageQuantity?: number | undefined;
	usageUnit?: string | undefined;
}

export function upsertCostEntries(entries: CostEntry[]): void {
	const db = getDb();
	const stmt = db.prepare(
		`INSERT INTO cost_entries (project_id, date, service, sku, description, amount, currency, usage_quantity, usage_unit)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(project_id, date, service, sku)
		 DO UPDATE SET amount = excluded.amount, currency = excluded.currency,
		   description = excluded.description,
		   usage_quantity = excluded.usage_quantity, usage_unit = excluded.usage_unit,
		   fetched_at = datetime('now')`,
	);

	const insertAll = db.transaction((entries: CostEntry[]) => {
		for (const e of entries) {
			stmt.run(
				e.projectId,
				e.date,
				e.service,
				e.sku,
				e.description,
				e.amount,
				e.currency,
				e.usageQuantity ?? null,
				e.usageUnit ?? null,
			);
		}
	});

	insertAll(entries);
}

export function getCostsByDateRange(projectId: string, from: string, to: string): CostEntry[] {
	const db = getDb();
	const rows = db
		.prepare(
			`SELECT project_id, date, service, sku, description, amount, currency,
			        usage_quantity, usage_unit
			 FROM cost_entries
			 WHERE project_id = ? AND date >= ? AND date <= ?
			 ORDER BY date ASC`,
		)
		.all(projectId, from, to) as Array<{
		project_id: string;
		date: string;
		service: string;
		sku: string;
		description: string;
		amount: number;
		currency: string;
		usage_quantity: number | null;
		usage_unit: string | null;
	}>;

	return rows.map((r) => ({
		projectId: r.project_id,
		date: r.date,
		service: r.service,
		sku: r.sku,
		description: r.description,
		amount: r.amount,
		currency: r.currency,
		usageQuantity: r.usage_quantity ?? undefined,
		usageUnit: r.usage_unit ?? undefined,
	}));
}

export function getLatestDataTimestamp(projectId: string): string | null {
	const db = getDb();
	const row = db
		.prepare('SELECT MAX(fetched_at) as latest FROM cost_entries WHERE project_id = ?')
		.get(projectId) as { latest: string | null } | undefined;

	return row?.latest ?? null;
}
