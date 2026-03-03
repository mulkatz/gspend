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

const {
	ConfigSchema,
	loadConfig,
	saveConfig,
	configExists,
	addProjectToConfig,
	setBillingExportConfig,
} = await import('./config.js');

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

	it('validates config with billingExports', () => {
		const result = ConfigSchema.safeParse({
			...validConfig,
			billingExports: {
				'BILLING-123': { projectId: 'other-proj', datasetId: 'billing_ds', currency: 'EUR' },
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.billingExports?.['BILLING-123']?.currency).toBe('EUR');
		}
	});

	it('validates config without billingExports (backward compatible)', () => {
		const result = ConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.billingExports).toBeUndefined();
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

describe('addProjectToConfig', () => {
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

	it('adds a project and returns updated config', () => {
		const updated = addProjectToConfig(validConfig, {
			projectId: 'new-project',
			displayName: 'New Project',
			billingAccountId: '123-ABC',
		});
		expect(updated.projects).toHaveLength(2);
		expect(updated.projects[1]).toEqual({
			projectId: 'new-project',
			displayName: 'New Project',
			billingAccountId: '123-ABC',
		});
	});

	it('preserves existing projects', () => {
		const updated = addProjectToConfig(validConfig, { projectId: 'another' });
		expect(updated.projects[0]).toEqual(validConfig.projects[0]);
	});

	it('persists to disk', () => {
		addProjectToConfig(validConfig, { projectId: 'persisted' });
		const loaded = loadConfig();
		expect(loaded.projects).toHaveLength(2);
		expect(loaded.projects[1]?.projectId).toBe('persisted');
	});

	it('handles optional fields', () => {
		const updated = addProjectToConfig(validConfig, { projectId: 'minimal' });
		expect(updated.projects[1]).toEqual({ projectId: 'minimal' });
	});
});

describe('setBillingExportConfig', () => {
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

	it('adds a billing export entry and returns updated config', () => {
		const updated = setBillingExportConfig(validConfig, 'BILLING-123', {
			projectId: 'other-proj',
			datasetId: 'billing_ds',
			currency: 'EUR',
		});
		expect(updated.billingExports?.['BILLING-123']).toEqual({
			projectId: 'other-proj',
			datasetId: 'billing_ds',
			currency: 'EUR',
		});
	});

	it('preserves existing billing export entries', () => {
		const withExisting: Config = {
			...validConfig,
			billingExports: { 'EXISTING-111': { projectId: 'proj-a' } },
		};
		const updated = setBillingExportConfig(withExisting, 'NEW-222', {
			projectId: 'proj-b',
			datasetId: 'ds',
		});
		expect(updated.billingExports?.['EXISTING-111']).toEqual({ projectId: 'proj-a' });
		expect(updated.billingExports?.['NEW-222']).toEqual({ projectId: 'proj-b', datasetId: 'ds' });
	});

	it('persists to disk', () => {
		setBillingExportConfig(validConfig, 'BILLING-456', { projectId: 'persisted-proj' });
		const loaded = loadConfig();
		expect(loaded.billingExports?.['BILLING-456']?.projectId).toBe('persisted-proj');
	});

	it('updates existing entry for same billing account', () => {
		const withExisting: Config = {
			...validConfig,
			billingExports: { 'BILLING-123': { projectId: 'old-proj' } },
		};
		const updated = setBillingExportConfig(withExisting, 'BILLING-123', {
			projectId: 'new-proj',
			datasetId: 'new-ds',
		});
		expect(updated.billingExports?.['BILLING-123']).toEqual({
			projectId: 'new-proj',
			datasetId: 'new-ds',
		});
	});
});
