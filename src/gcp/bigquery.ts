import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryError } from '../errors.js';

export interface MonthlySummary {
	totalCost: number;
	netCost: number;
	currency: string;
	dailyCosts: DailyCost[];
}

export interface ServiceBreakdown {
	service: string;
	amount: number;
	percentage: number;
	currency: string;
}

export interface SkuBreakdown {
	sku: string;
	description: string;
	amount: number;
	percentage: number;
	currency: string;
}

export interface DailyCost {
	date: string;
	amount: number;
	currency: string;
}

export interface DiscoveredExport {
	projectId: string;
	datasetId: string;
	tableId: string;
}

function getBqClient(projectId: string): BigQuery {
	return new BigQuery({ projectId });
}

export async function discoverBillingExport(
	projectIds: string[],
): Promise<DiscoveredExport | null> {
	for (const projectId of projectIds) {
		let datasets: Array<{ id?: string | null }>;
		try {
			const bq = getBqClient(projectId);
			const [result] = await bq.getDatasets();
			datasets = result;
		} catch {
			continue;
		}

		for (const ds of datasets) {
			if (!ds.id) continue;
			const tableId = await checkBillingExportExists(projectId, ds.id);
			if (tableId) {
				return { projectId, datasetId: ds.id, tableId };
			}
		}
	}
	return null;
}

export async function checkBillingExportExists(
	projectId: string,
	datasetId: string,
): Promise<string | null> {
	try {
		return await findBillingExportTable(projectId, datasetId);
	} catch {
		return null;
	}
}

export async function findBillingExportTable(
	projectId: string,
	datasetId: string,
): Promise<string | null> {
	try {
		const bq = getBqClient(projectId);
		const [tables] = await bq.dataset(datasetId).getTables();

		const billingTable = tables.find((t) => t.id?.startsWith('gcp_billing_export_v1_'));

		return billingTable?.id ?? null;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new BigQueryError(
			`Failed to discover billing export table: ${msg}`,
			`Ensure billing export is enabled for dataset "${datasetId}" in project "${projectId}".`,
		);
	}
}

const GCP_IDENTIFIER = /^[a-zA-Z0-9_.-]+$/;

function fullTableRef(projectId: string, datasetId: string, tableId: string): string {
	if (
		!GCP_IDENTIFIER.test(projectId) ||
		!GCP_IDENTIFIER.test(datasetId) ||
		!GCP_IDENTIFIER.test(tableId)
	) {
		throw new BigQueryError('Invalid BigQuery identifier: contains disallowed characters');
	}
	return `\`${projectId}.${datasetId}.${tableId}\``;
}

export async function getCurrentMonthCosts(
	projectId: string,
	datasetId: string,
	tableId: string,
	filterProjectId?: string | undefined,
	currency = 'USD',
): Promise<MonthlySummary> {
	const bq = getBqClient(projectId);
	const table = fullTableRef(projectId, datasetId, tableId);

	const projectFilter = filterProjectId ? 'AND project.id = @filterProject' : '';

	const query = `
		SELECT
			FORMAT_DATE('%Y-%m-%d', usage_start_time) as date,
			SUM(cost) as total_cost,
			SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as net_cost
		FROM ${table}
		WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
		AND currency = @currency
		${projectFilter}
		GROUP BY date
		ORDER BY date ASC
	`;

	const params: Record<string, string> = { currency };
	if (filterProjectId) params.filterProject = filterProjectId;

	try {
		const [rows] = await bq.query({ query, params });
		const typedRows = rows as Array<{
			date: string;
			total_cost: number;
			net_cost: number;
		}>;

		const totalCost = typedRows.reduce((sum, r) => sum + r.total_cost, 0);
		const netCost = typedRows.reduce((sum, r) => sum + r.net_cost, 0);
		const dailyCosts = typedRows.map((r) => ({
			date: r.date,
			amount: r.net_cost,
			currency,
		}));

		return { totalCost, netCost, currency, dailyCosts };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new BigQueryError(`Failed to query current month costs: ${msg}`);
	}
}

export async function getCostsByService(
	projectId: string,
	datasetId: string,
	tableId: string,
	filterProjectId?: string | undefined,
	month?: string | undefined,
	currency = 'USD',
): Promise<ServiceBreakdown[]> {
	const bq = getBqClient(projectId);
	const table = fullTableRef(projectId, datasetId, tableId);

	const monthFilter = month
		? 'invoice.month = @month'
		: "invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())";
	const projectFilter = filterProjectId ? 'AND project.id = @filterProject' : '';

	const query = `
		SELECT
			service.description as service,
			SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as amount
		FROM ${table}
		WHERE ${monthFilter}
		AND currency = @currency
		${projectFilter}
		GROUP BY service
		HAVING amount != 0
		ORDER BY amount DESC
	`;

	const params: Record<string, string> = { currency };
	if (month) {
		if (!/^\d{4}-\d{2}$/.test(month)) {
			throw new BigQueryError('Month must be in YYYY-MM format (e.g., 2026-02)');
		}
		params.month = month.replace('-', '');
	}
	if (filterProjectId) params.filterProject = filterProjectId;

	try {
		const [rows] = await bq.query({ query, params });
		const typedRows = rows as Array<{
			service: string;
			amount: number;
		}>;

		const total = typedRows.reduce((sum, r) => sum + Math.abs(r.amount), 0);

		return typedRows.map((r) => ({
			service: r.service,
			amount: r.amount,
			percentage: total > 0 ? (Math.abs(r.amount) / total) * 100 : 0,
			currency,
		}));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new BigQueryError(`Failed to query costs by service: ${msg}`);
	}
}

export async function getCostsBySku(
	projectId: string,
	datasetId: string,
	tableId: string,
	service?: string | undefined,
	filterProjectId?: string | undefined,
	month?: string | undefined,
	currency = 'USD',
): Promise<SkuBreakdown[]> {
	const bq = getBqClient(projectId);
	const table = fullTableRef(projectId, datasetId, tableId);

	const monthFilter = month
		? 'invoice.month = @month'
		: "invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())";
	const serviceFilter = service ? 'AND service.description = @service' : '';
	const projectFilter = filterProjectId ? 'AND project.id = @filterProject' : '';

	const query = `
		SELECT
			sku.id as sku,
			sku.description as description,
			SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as amount
		FROM ${table}
		WHERE ${monthFilter}
		AND currency = @currency
		${serviceFilter}
		${projectFilter}
		GROUP BY sku, description
		HAVING amount != 0
		ORDER BY amount DESC
	`;

	const params: Record<string, string> = { currency };
	if (month) {
		if (!/^\d{4}-\d{2}$/.test(month)) {
			throw new BigQueryError('Month must be in YYYY-MM format (e.g., 2026-02)');
		}
		params.month = month.replace('-', '');
	}
	if (service) params.service = service;
	if (filterProjectId) params.filterProject = filterProjectId;

	try {
		const [rows] = await bq.query({ query, params });
		const typedRows = rows as Array<{
			sku: string;
			description: string;
			amount: number;
		}>;

		const total = typedRows.reduce((sum, r) => sum + Math.abs(r.amount), 0);

		return typedRows.map((r) => ({
			sku: r.sku,
			description: r.description,
			amount: r.amount,
			percentage: total > 0 ? (Math.abs(r.amount) / total) * 100 : 0,
			currency,
		}));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new BigQueryError(`Failed to query costs by SKU: ${msg}`);
	}
}

export async function getDailyCosts(
	projectId: string,
	datasetId: string,
	tableId: string,
	filterProjectId?: string | undefined,
	days = 14,
	currency = 'USD',
): Promise<DailyCost[]> {
	const bq = getBqClient(projectId);
	const table = fullTableRef(projectId, datasetId, tableId);

	const projectFilter = filterProjectId ? 'AND project.id = @filterProject' : '';

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	const cutoffIso = cutoff.toISOString();

	const query = `
		SELECT
			FORMAT_DATE('%Y-%m-%d', usage_start_time) as date,
			SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as amount
		FROM ${table}
		WHERE usage_start_time >= TIMESTAMP(@cutoff)
		AND currency = @currency
		${projectFilter}
		GROUP BY date
		ORDER BY date ASC
	`;

	const params: Record<string, string> = { cutoff: cutoffIso, currency };
	if (filterProjectId) params.filterProject = filterProjectId;

	try {
		const [rows] = await bq.query({ query, params });
		const typedRows = rows as Array<{
			date: string;
			amount: number;
		}>;

		return typedRows.map((r) => ({
			date: r.date,
			amount: r.amount,
			currency,
		}));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new BigQueryError(`Failed to query daily costs: ${msg}`);
	}
}

export async function getDataFreshness(
	projectId: string,
	datasetId: string,
	tableId: string,
): Promise<Date> {
	const bq = getBqClient(projectId);
	const table = fullTableRef(projectId, datasetId, tableId);

	const query = `SELECT MAX(export_time) as latest FROM ${table}`;

	try {
		const [rows] = await bq.query({ query });
		const typedRows = rows as Array<{ latest: { value: string } | null }>;
		const latest = typedRows[0]?.latest;

		if (!latest) {
			throw new BigQueryError('No billing data found in export table.');
		}

		return new Date(latest.value);
	} catch (error) {
		if (error instanceof BigQueryError) throw error;
		const msg = error instanceof Error ? error.message : String(error);
		throw new BigQueryError(`Failed to check data freshness: ${msg}`);
	}
}
