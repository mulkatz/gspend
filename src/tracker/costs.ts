import { type Config, saveConfig } from '../config.js';
import { ConfigError } from '../errors.js';
import type { DailyCost, MonthlySummary, ServiceBreakdown, SkuBreakdown } from '../gcp/bigquery.js';
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

interface ResolvedExport {
	projectId: string;
	datasetId: string;
	table: string;
	currency: string;
}

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

async function requireBillingExportConfig(
	config: Config,
	billingAccountId: string,
): Promise<{ datasetId: string; table: string }> {
	const exportConfig = config.billingExports?.[billingAccountId];
	if (!exportConfig) {
		throw new ConfigError(`No billing export configured for account ${billingAccountId}.`);
	}

	const { projectId, datasetId, tableId } = exportConfig;
	if (tableId && datasetId) return { datasetId, table: tableId };

	if (!datasetId) {
		throw new ConfigError(
			`BigQuery dataset not configured for billing account ${billingAccountId}.`,
			'Configure billing export in GCP Console, then re-add the project.',
		);
	}

	// Lazy discovery per-export
	try {
		const found = await findBillingExportTable(projectId, datasetId);
		if (found) {
			exportConfig.tableId = found;
			saveConfig(config);
			return { datasetId, table: found };
		}
	} catch {
		// Discovery failed — fall through to error
	}

	throw new ConfigError(
		`BigQuery billing export table not found for account ${billingAccountId}.`,
		'Ensure billing export is enabled in GCP Console.',
	);
}

export async function resolveBillingExport(
	config: Config,
	filterProjectId?: string | undefined,
): Promise<ResolvedExport> {
	if (filterProjectId) {
		const project = config.projects.find((p) => p.projectId === filterProjectId);
		const billingAccountId = project?.billingAccountId;

		if (billingAccountId && config.billingExports?.[billingAccountId]) {
			const exportConfig = config.billingExports[billingAccountId];
			const { datasetId, table } = await requireBillingExportConfig(config, billingAccountId);
			return {
				projectId: exportConfig.projectId,
				datasetId,
				table,
				currency: exportConfig.currency ?? config.currency,
			};
		}
	}

	// Fallback to global config
	const { datasetId, table } = await requireBigQueryConfig(config);
	return {
		projectId: config.bigquery.projectId,
		datasetId,
		table,
		currency: config.currency,
	};
}

function getUniqueBillingAccounts(config: Config): Map<string, ResolvedExportSource> {
	const accounts = new Map<string, ResolvedExportSource>();

	// Collect billing accounts from projects
	for (const project of config.projects) {
		if (project.billingAccountId && !accounts.has(project.billingAccountId)) {
			const exportConfig = config.billingExports?.[project.billingAccountId];
			if (exportConfig) {
				const entry: ResolvedExportSource['exportConfig'] = {
					projectId: exportConfig.projectId,
				};
				if (exportConfig.datasetId) entry.datasetId = exportConfig.datasetId;
				if (exportConfig.tableId) entry.tableId = exportConfig.tableId;
				if (exportConfig.currency) entry.currency = exportConfig.currency;
				accounts.set(project.billingAccountId, { type: 'export', exportConfig: entry });
			} else {
				accounts.set(project.billingAccountId, { type: 'default' });
			}
		}
	}

	return accounts;
}

interface ResolvedExportSource {
	type: 'export' | 'default';
	exportConfig?: { projectId: string; datasetId?: string; tableId?: string; currency?: string };
}

function mergeMonthlySummaries(summaries: MonthlySummary[]): MonthlySummary {
	const byDate = new Map<string, { amount: number; currency: string }>();
	let totalCost = 0;
	let netCost = 0;
	const currency = summaries[0]?.currency ?? 'USD';

	for (const s of summaries) {
		totalCost += s.totalCost;
		netCost += s.netCost;
		for (const d of s.dailyCosts) {
			const existing = byDate.get(d.date);
			if (existing) {
				existing.amount += d.amount;
			} else {
				byDate.set(d.date, { amount: d.amount, currency });
			}
		}
	}

	const dailyCosts = [...byDate.entries()]
		.map(([date, { amount }]) => ({ date, amount, currency }))
		.sort((a, b) => a.date.localeCompare(b.date));

	return { totalCost, netCost, currency, dailyCosts };
}

function mergeServiceBreakdowns(arrays: ServiceBreakdown[][]): ServiceBreakdown[] {
	const byService = new Map<string, { amount: number; currency: string }>();

	for (const arr of arrays) {
		for (const s of arr) {
			const existing = byService.get(s.service);
			if (existing) {
				existing.amount += s.amount;
			} else {
				byService.set(s.service, { amount: s.amount, currency: s.currency });
			}
		}
	}

	const total = [...byService.values()].reduce((sum, s) => sum + Math.abs(s.amount), 0);

	return [...byService.entries()]
		.map(([service, { amount, currency }]) => ({
			service,
			amount,
			percentage: total > 0 ? (Math.abs(amount) / total) * 100 : 0,
			currency,
		}))
		.sort((a, b) => b.amount - a.amount);
}

function mergeDailyCosts(arrays: DailyCost[][]): DailyCost[] {
	const byDate = new Map<string, { amount: number; currency: string }>();

	for (const arr of arrays) {
		for (const d of arr) {
			const existing = byDate.get(d.date);
			if (existing) {
				existing.amount += d.amount;
			} else {
				byDate.set(d.date, { amount: d.amount, currency: d.currency });
			}
		}
	}

	return [...byDate.entries()]
		.map(([date, { amount, currency }]) => ({ date, amount, currency }))
		.sort((a, b) => a.date.localeCompare(b.date));
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
	excludedCurrencies?: string[];
}

export interface BreakdownResult {
	items: ServiceBreakdown[] | SkuBreakdown[];
	currency: string;
	month: string;
	excludedCurrencies?: string[];
}

async function fetchStatusForExport(
	resolved: ResolvedExport,
	filterProjectId: string | undefined,
): Promise<{
	monthlySummary: MonthlySummary;
	services: ServiceBreakdown[];
	dailyCosts: DailyCost[];
	freshness: Date;
}> {
	const [monthlySummary, services, dailyCosts, freshness] = await Promise.all([
		getCurrentMonthCosts(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			filterProjectId,
			resolved.currency,
		),
		bqGetCostsByService(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			filterProjectId,
			undefined,
			resolved.currency,
		),
		bqGetDailyCosts(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			filterProjectId,
			14,
			resolved.currency,
		),
		getDataFreshness(resolved.projectId, resolved.datasetId, resolved.table),
	]);
	return { monthlySummary, services, dailyCosts, freshness };
}

function hasMultipleBillingExports(config: Config): boolean {
	return config.billingExports !== undefined && Object.keys(config.billingExports).length > 0;
}

export async function getCostStatus(
	config: Config,
	filterProjectId?: string | undefined,
): Promise<CostStatus> {
	const cacheKey = `status:${filterProjectId ?? 'all'}`;
	const cached = getCached<CostStatus>(cacheKey);
	if (cached) return cached;

	// Multi-account aggregation for "All Projects" view
	if (!filterProjectId && hasMultipleBillingExports(config)) {
		return getAggregatedCostStatus(config);
	}

	const resolved = await resolveBillingExport(config, filterProjectId);

	const { monthlySummary, services, dailyCosts, freshness } = await fetchStatusForExport(
		resolved,
		filterProjectId,
	);

	const status = buildCostStatus(monthlySummary, services, dailyCosts, freshness, filterProjectId);

	setCache(cacheKey, status, DEFAULT_TTL.status);
	return status;
}

async function getAggregatedCostStatus(config: Config): Promise<CostStatus> {
	const cacheKey = 'status:all';
	const accounts = getUniqueBillingAccounts(config);

	const matchingExports: ResolvedExport[] = [];
	const excludedCurrencies: string[] = [];

	// Resolve all unique billing accounts
	for (const [accountId, source] of accounts) {
		if (source.type === 'export' && source.exportConfig) {
			const currency = source.exportConfig.currency ?? config.currency;
			if (currency !== config.currency) {
				if (!excludedCurrencies.includes(currency)) {
					excludedCurrencies.push(currency);
				}
				continue;
			}
			try {
				const { datasetId, table } = await requireBillingExportConfig(config, accountId);
				matchingExports.push({
					projectId: source.exportConfig.projectId,
					datasetId,
					table,
					currency,
				});
			} catch {
				// Skip unconfigured exports
			}
		} else {
			// Default account — use config.bigquery
			try {
				const { datasetId, table } = await requireBigQueryConfig(config);
				matchingExports.push({
					projectId: config.bigquery.projectId,
					datasetId,
					table,
					currency: config.currency,
				});
			} catch {
				// Skip if default not configured
			}
		}
	}

	if (matchingExports.length === 0) {
		// Fall back to single-export path
		const resolved = await resolveBillingExport(config, undefined);
		const { monthlySummary, services, dailyCosts, freshness } = await fetchStatusForExport(
			resolved,
			undefined,
		);
		const status = buildCostStatus(monthlySummary, services, dailyCosts, freshness, undefined);
		if (excludedCurrencies.length > 0) {
			status.excludedCurrencies = excludedCurrencies;
		}
		setCache(cacheKey, status, DEFAULT_TTL.status);
		return status;
	}

	// Deduplicate exports by projectId+datasetId+table
	const seen = new Set<string>();
	const uniqueExports: ResolvedExport[] = [];
	for (const exp of matchingExports) {
		const key = `${exp.projectId}:${exp.datasetId}:${exp.table}`;
		if (!seen.has(key)) {
			seen.add(key);
			uniqueExports.push(exp);
		}
	}

	// Query all exports in parallel
	const results = await Promise.all(
		uniqueExports.map((exp) => fetchStatusForExport(exp, undefined)),
	);

	const monthlySummary = mergeMonthlySummaries(results.map((r) => r.monthlySummary));
	const services = mergeServiceBreakdowns(results.map((r) => r.services));
	const dailyCosts = mergeDailyCosts(results.map((r) => r.dailyCosts));
	const firstResult = results[0];
	if (!firstResult) {
		throw new ConfigError('No billing export results available for aggregation.');
	}
	const oldestFreshness = results.reduce(
		(oldest, r) => (r.freshness < oldest ? r.freshness : oldest),
		firstResult.freshness,
	);

	const status = buildCostStatus(monthlySummary, services, dailyCosts, oldestFreshness, undefined);
	if (excludedCurrencies.length > 0) {
		status.excludedCurrencies = excludedCurrencies;
	}

	setCache(cacheKey, status, DEFAULT_TTL.status);
	return status;
}

function buildCostStatus(
	monthlySummary: MonthlySummary,
	services: ServiceBreakdown[],
	dailyCosts: DailyCost[],
	freshness: Date,
	filterProjectId: string | undefined,
): CostStatus {
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

	return {
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

	const currentMonth = month ?? new Date().toISOString().slice(0, 7);

	// Multi-account aggregation for "All Projects" breakdown (service-level only)
	if (!filterProjectId && !service && hasMultipleBillingExports(config)) {
		return getAggregatedBreakdown(config, month, currentMonth);
	}

	const resolved = await resolveBillingExport(config, filterProjectId);

	let items: ServiceBreakdown[] | SkuBreakdown[];
	if (service) {
		items = await bqGetCostsBySku(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			service,
			filterProjectId,
			month,
			resolved.currency,
		);
	} else {
		items = await bqGetCostsByService(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			filterProjectId,
			month,
			resolved.currency,
		);
	}

	const currency = items[0]?.currency ?? resolved.currency;

	const result: BreakdownResult = { items, currency, month: currentMonth };
	setCache(cacheKey, result, DEFAULT_TTL.breakdown);
	return result;
}

async function getAggregatedBreakdown(
	config: Config,
	month: string | undefined,
	currentMonth: string,
): Promise<BreakdownResult> {
	const cacheKey = `breakdown:all:${month ?? 'current'}:all`;
	const accounts = getUniqueBillingAccounts(config);

	const matchingExports: ResolvedExport[] = [];
	const excludedCurrencies: string[] = [];

	for (const [accountId, source] of accounts) {
		if (source.type === 'export' && source.exportConfig) {
			const currency = source.exportConfig.currency ?? config.currency;
			if (currency !== config.currency) {
				if (!excludedCurrencies.includes(currency)) excludedCurrencies.push(currency);
				continue;
			}
			try {
				const { datasetId, table } = await requireBillingExportConfig(config, accountId);
				matchingExports.push({
					projectId: source.exportConfig.projectId,
					datasetId,
					table,
					currency,
				});
			} catch {
				// Skip unconfigured exports
			}
		} else {
			try {
				const { datasetId, table } = await requireBigQueryConfig(config);
				matchingExports.push({
					projectId: config.bigquery.projectId,
					datasetId,
					table,
					currency: config.currency,
				});
			} catch {
				// Skip unconfigured exports
			}
		}
	}

	// Deduplicate
	const seen = new Set<string>();
	const uniqueExports: ResolvedExport[] = [];
	for (const exp of matchingExports) {
		const key = `${exp.projectId}:${exp.datasetId}:${exp.table}`;
		if (!seen.has(key)) {
			seen.add(key);
			uniqueExports.push(exp);
		}
	}

	if (uniqueExports.length === 0) {
		const resolved = await resolveBillingExport(config, undefined);
		const items = await bqGetCostsByService(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			undefined,
			month,
			resolved.currency,
		);
		const result: BreakdownResult = {
			items,
			currency: items[0]?.currency ?? resolved.currency,
			month: currentMonth,
		};
		if (excludedCurrencies.length > 0) result.excludedCurrencies = excludedCurrencies;
		setCache(cacheKey, result, DEFAULT_TTL.breakdown);
		return result;
	}

	const serviceArrays = await Promise.all(
		uniqueExports.map((exp) =>
			bqGetCostsByService(exp.projectId, exp.datasetId, exp.table, undefined, month, exp.currency),
		),
	);

	const items = mergeServiceBreakdowns(serviceArrays);
	const currency = items[0]?.currency ?? config.currency;

	const result: BreakdownResult = { items, currency, month: currentMonth };
	if (excludedCurrencies.length > 0) result.excludedCurrencies = excludedCurrencies;
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

	// Multi-account aggregation for "All Projects" history
	if (!filterProjectId && hasMultipleBillingExports(config)) {
		return getAggregatedHistory(config, days);
	}

	const resolved = await resolveBillingExport(config, filterProjectId);

	const costs = await bqGetDailyCosts(
		resolved.projectId,
		resolved.datasetId,
		resolved.table,
		filterProjectId,
		days,
		resolved.currency,
	);

	setCache(cacheKey, costs, DEFAULT_TTL.history);
	return costs;
}

async function getAggregatedHistory(config: Config, days: number): Promise<DailyCost[]> {
	const cacheKey = `history:${days}:all`;
	const accounts = getUniqueBillingAccounts(config);

	const matchingExports: ResolvedExport[] = [];

	for (const [accountId, source] of accounts) {
		if (source.type === 'export' && source.exportConfig) {
			const currency = source.exportConfig.currency ?? config.currency;
			if (currency !== config.currency) continue;
			try {
				const { datasetId, table } = await requireBillingExportConfig(config, accountId);
				matchingExports.push({
					projectId: source.exportConfig.projectId,
					datasetId,
					table,
					currency,
				});
			} catch {
				// Skip unconfigured exports
			}
		} else {
			try {
				const { datasetId, table } = await requireBigQueryConfig(config);
				matchingExports.push({
					projectId: config.bigquery.projectId,
					datasetId,
					table,
					currency: config.currency,
				});
			} catch {
				// Skip unconfigured exports
			}
		}
	}

	// Deduplicate
	const seen = new Set<string>();
	const uniqueExports: ResolvedExport[] = [];
	for (const exp of matchingExports) {
		const key = `${exp.projectId}:${exp.datasetId}:${exp.table}`;
		if (!seen.has(key)) {
			seen.add(key);
			uniqueExports.push(exp);
		}
	}

	if (uniqueExports.length === 0) {
		const resolved = await resolveBillingExport(config, undefined);
		const costs = await bqGetDailyCosts(
			resolved.projectId,
			resolved.datasetId,
			resolved.table,
			undefined,
			days,
			resolved.currency,
		);
		setCache(cacheKey, costs, DEFAULT_TTL.history);
		return costs;
	}

	const costArrays = await Promise.all(
		uniqueExports.map((exp) =>
			bqGetDailyCosts(exp.projectId, exp.datasetId, exp.table, undefined, days, exp.currency),
		),
	);

	const costs = mergeDailyCosts(costArrays);
	setCache(cacheKey, costs, DEFAULT_TTL.history);
	return costs;
}
