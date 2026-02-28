import { type Config, saveConfig } from '../config.js';
import { ConfigError } from '../errors.js';
import type { DailyCost, ServiceBreakdown, SkuBreakdown } from '../gcp/bigquery.js';
import {
	getCostsByService as bqGetCostsByService,
	getCostsBySku as bqGetCostsBySku,
	getDailyCosts as bqGetDailyCosts,
	findBillingExportTable,
	getCurrentMonthCosts,
	getDataFreshness,
} from '../gcp/bigquery.js';
import { DEFAULT_TTL, getCached, setCache } from '../store/cache.js';
import { upsertCostEntries } from '../store/history.js';
import { forecastEndOfMonth } from './forecast.js';
import { detectTrend, type TrendResult } from './trend.js';

async function requireBigQueryConfig(
	config: Config,
): Promise<{ datasetId: string; table: string }> {
	const { projectId, datasetId, tableId } = config.bigquery;
	if (tableId && datasetId) return { datasetId, table: tableId };

	if (!datasetId) {
		throw new ConfigError(
			'BigQuery dataset not configured.',
			'Run: gspend init (ensure billing export is enabled in GCP Console first)',
		);
	}

	// Lazy discovery: try to find the billing export table
	try {
		const found = await findBillingExportTable(projectId, datasetId);
		if (found) {
			config.bigquery.tableId = found;
			saveConfig(config);
			return { datasetId, table: found };
		}
	} catch {
		// Discovery failed — fall through to error
	}

	throw new ConfigError(
		'BigQuery billing export table not configured.',
		'Run: gspend init (ensure billing export is enabled in GCP Console first)',
	);
}

export interface CostStatus {
	today: number;
	thisWeek: number;
	thisMonth: number;
	netMonth: number;
	topServices: ServiceBreakdown[];
	trend: TrendResult;
	forecast: number;
	currency: string;
	dataFreshness: number; // Unix timestamp (ms) — survives JSON cache serialization
}

export interface BreakdownResult {
	items: ServiceBreakdown[] | SkuBreakdown[];
	currency: string;
	month: string;
}

export async function getCostStatus(
	config: Config,
	filterProjectId?: string | undefined,
): Promise<CostStatus> {
	const cacheKey = `status:${filterProjectId ?? 'all'}`;
	const cached = getCached<CostStatus>(cacheKey);
	if (cached) return cached;

	const { projectId } = config.bigquery;
	const { datasetId, table } = await requireBigQueryConfig(config);

	const [monthlySummary, services, dailyCosts, freshness] = await Promise.all([
		getCurrentMonthCosts(projectId, datasetId, table, filterProjectId, config.currency),
		bqGetCostsByService(projectId, datasetId, table, filterProjectId, undefined, config.currency),
		bqGetDailyCosts(projectId, datasetId, table, filterProjectId, 14, config.currency),
		getDataFreshness(projectId, datasetId, table),
	]);

	const today = new Date().toISOString().slice(0, 10);
	const todayCost = monthlySummary.dailyCosts.find((d) => d.date === today)?.amount ?? 0;

	const weekStart = new Date();
	const dayOfWeek = weekStart.getDay();
	const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	weekStart.setDate(weekStart.getDate() + mondayOffset);
	const weekStartStr = weekStart.toISOString().slice(0, 10);
	const thisWeek = monthlySummary.dailyCosts
		.filter((d) => d.date >= weekStartStr)
		.reduce((sum, d) => sum + d.amount, 0);

	const trend = detectTrend(dailyCosts);
	const forecast = forecastEndOfMonth(dailyCosts);

	// Store in history for offline access
	const entries = monthlySummary.dailyCosts.map((d) => ({
		projectId: filterProjectId ?? 'all',
		date: d.date,
		service: '_total',
		sku: '_total',
		description: 'Daily total',
		amount: d.amount,
		currency: d.currency,
	}));
	if (entries.length > 0) {
		upsertCostEntries(entries);
	}

	const status: CostStatus = {
		today: todayCost,
		thisWeek: thisWeek,
		thisMonth: monthlySummary.totalCost,
		netMonth: monthlySummary.netCost,
		topServices: services.slice(0, 5),
		trend,
		forecast,
		currency: monthlySummary.currency,
		dataFreshness: freshness.getTime(),
	};

	setCache(cacheKey, status, DEFAULT_TTL.status);
	return status;
}

export async function getBreakdown(
	config: Config,
	service?: string | undefined,
	month?: string | undefined,
	filterProjectId?: string | undefined,
): Promise<BreakdownResult> {
	const cacheKey = `breakdown:${service ?? 'all'}:${month ?? 'current'}:${filterProjectId ?? 'all'}`;
	const cached = getCached<BreakdownResult>(cacheKey);
	if (cached) return cached;

	const { projectId } = config.bigquery;
	const { datasetId, table } = await requireBigQueryConfig(config);

	const currentMonth = month ?? new Date().toISOString().slice(0, 7);

	let items: ServiceBreakdown[] | SkuBreakdown[];
	if (service) {
		items = await bqGetCostsBySku(
			projectId,
			datasetId,
			table,
			service,
			filterProjectId,
			month,
			config.currency,
		);
	} else {
		items = await bqGetCostsByService(
			projectId,
			datasetId,
			table,
			filterProjectId,
			month,
			config.currency,
		);
	}

	const currency = items[0]?.currency ?? config.currency;

	const result: BreakdownResult = { items, currency, month: currentMonth };
	setCache(cacheKey, result, DEFAULT_TTL.breakdown);
	return result;
}

export async function getHistory(
	config: Config,
	days = 14,
	filterProjectId?: string | undefined,
): Promise<DailyCost[]> {
	const cacheKey = `history:${days}:${filterProjectId ?? 'all'}`;
	const cached = getCached<DailyCost[]>(cacheKey);
	if (cached) return cached;

	const { projectId } = config.bigquery;
	const { datasetId, table } = await requireBigQueryConfig(config);

	const costs = await bqGetDailyCosts(
		projectId,
		datasetId,
		table,
		filterProjectId,
		days,
		config.currency,
	);

	setCache(cacheKey, costs, DEFAULT_TTL.history);
	return costs;
}
