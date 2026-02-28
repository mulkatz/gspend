import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock env-paths to use temp directories for testing
const testDir = { config: '', data: '' };
vi.mock('env-paths', () => ({
	default: () => testDir,
}));

// Import after mock
const { getConfigDir, getConfigPath, getDataDir, getDbPath, ensurePaths } = await import(
	'./paths.js'
);

describe('paths', () => {
	let tempBase: string;

	beforeEach(() => {
		tempBase = mkdtempSync(join(tmpdir(), 'gspend-test-'));
		testDir.config = join(tempBase, 'config');
		testDir.data = join(tempBase, 'data');
	});

	afterEach(() => {
		rmSync(tempBase, { recursive: true, force: true });
	});

	it('returns config path ending with config.json', () => {
		expect(getConfigPath().endsWith('config.json')).toBe(true);
	});

	it('returns db path ending with gspend.db', () => {
		expect(getDbPath().endsWith('gspend.db')).toBe(true);
	});

	it('config dir is a prefix of config path', () => {
		expect(getConfigPath().startsWith(getConfigDir())).toBe(true);
	});

	it('data dir is a prefix of db path', () => {
		expect(getDbPath().startsWith(getDataDir())).toBe(true);
	});

	it('ensurePaths creates directories', () => {
		expect(existsSync(testDir.config)).toBe(false);
		expect(existsSync(testDir.data)).toBe(false);
		ensurePaths();
		expect(existsSync(testDir.config)).toBe(true);
		expect(existsSync(testDir.data)).toBe(true);
	});
});
