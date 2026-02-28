import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ConfigError } from './errors.js';
import { ensurePaths, getConfigPath } from './paths.js';

const gcpIdentifier = z
	.string()
	.regex(
		/^[a-zA-Z0-9_.-]+$/,
		'Must contain only alphanumeric characters, dots, hyphens, or underscores',
	);

const BigQueryConfigSchema = z.object({
	projectId: gcpIdentifier,
	datasetId: gcpIdentifier.optional(),
	tableId: gcpIdentifier.optional(),
});

const ProjectConfigSchema = z.object({
	projectId: z.string(),
	displayName: z.string().optional(),
	billingAccountId: z.string().optional(),
	monthlyBudget: z.number().positive().optional(),
	budgetWarnPercent: z.number().min(0).max(100).optional(),
});

export const ConfigSchema = z.object({
	projects: z.array(ProjectConfigSchema).min(1),
	bigquery: BigQueryConfigSchema,
	currency: z.string().default('USD'),
	pollInterval: z.number().positive().default(300),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type BigQueryConfig = z.infer<typeof BigQueryConfigSchema>;

export function loadConfig(): Config {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		throw new ConfigError('No configuration found.', 'Run: gspend init');
	}

	const raw = readFileSync(configPath, 'utf-8');
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new ConfigError(
			'Config file is corrupted or contains invalid JSON.',
			'Run: gspend init to reconfigure.',
		);
	}
	const parsed = ConfigSchema.safeParse(json);
	if (!parsed.success) {
		throw new ConfigError(
			`Invalid config: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
			'Run: gspend init to reconfigure.',
		);
	}
	return parsed.data;
}

export function saveConfig(config: Config): void {
	ensurePaths();
	writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export function configExists(): boolean {
	return existsSync(getConfigPath());
}
