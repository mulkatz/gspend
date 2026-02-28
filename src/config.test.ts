import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from './config.js';
import { ConfigError } from './errors.js';

const testDir = { config: '', data: '' };

vi.mock('./paths.js', () => ({
	getConfigPath: () => join(testDir.config, 'config.json'),
	getConfigDir: () => testDir.config,
	ensurePaths: () => {
		const { mkdirSync } = require('node:fs');
		mkdirSync(testDir.config, { recursive: true });
		mkdirSync(testDir.data, { recursive: true });
	},
}));

const { ConfigSchema, loadConfig, saveConfig, configExists } = await import('./config.js');

const validConfig: Config = {
	projects: [{ projectId: 'my-project' }],
	bigquery: { projectId: 'my-project', datasetId: 'billing_dataset' },
	currency: 'USD',
	pollInterval: 300,
};

describe('ConfigSchema', () => {
	it('validates a correct config object', () => {
		const result = ConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
	});

	it('rejects invalid BigQuery project IDs', () => {
		const result = ConfigSchema.safeParse({
			...validConfig,
			bigquery: { projectId: 'invalid id!', datasetId: 'ok' },
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty projects array', () => {
		const result = ConfigSchema.safeParse({
			...validConfig,
			projects: [],
		});
		expect(result.success).toBe(false);
	});

	it('applies defaults for currency and pollInterval', () => {
		const result = ConfigSchema.safeParse({
			projects: [{ projectId: 'test' }],
			bigquery: { projectId: 'test', datasetId: 'ds' },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.currency).toBe('USD');
			expect(result.data.pollInterval).toBe(300);
		}
	});
});

describe('loadConfig', () => {
	let tempBase: string;

	beforeEach(() => {
		tempBase = mkdtempSync(join(tmpdir(), 'gspend-config-test-'));
		testDir.config = join(tempBase, 'config');
		testDir.data = join(tempBase, 'data');
		const { mkdirSync } = require('node:fs');
		mkdirSync(testDir.config, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempBase, { recursive: true, force: true });
	});

	it('throws ConfigError when file does not exist', () => {
		expect(() => loadConfig()).toThrow(ConfigError);
	});

	it('throws ConfigError for invalid JSON', () => {
		writeFileSync(join(testDir.config, 'config.json'), '{not valid json}');
		expect(() => loadConfig()).toThrow(ConfigError);
	});

	it('throws ConfigError for schema violation', () => {
		writeFileSync(join(testDir.config, 'config.json'), JSON.stringify({ projects: [] }));
		expect(() => loadConfig()).toThrow(ConfigError);
	});

	it('roundtrips with saveConfig', () => {
		saveConfig(validConfig);
		const loaded = loadConfig();
		expect(loaded).toEqual(validConfig);
	});
});

describe('configExists', () => {
	let tempBase: string;

	beforeEach(() => {
		tempBase = mkdtempSync(join(tmpdir(), 'gspend-config-test-'));
		testDir.config = join(tempBase, 'config');
		testDir.data = join(tempBase, 'data');
	});

	afterEach(() => {
		rmSync(tempBase, { recursive: true, force: true });
	});

	it('returns false when config does not exist', () => {
		expect(configExists()).toBe(false);
	});

	it('returns true after saving config', () => {
		saveConfig(validConfig);
		expect(configExists()).toBe(true);
	});
});
