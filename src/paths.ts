import { mkdirSync } from 'node:fs';
import envPaths from 'env-paths';

const paths = envPaths('gspend', { suffix: '' });

export function getConfigDir(): string {
	return paths.config;
}

export function getConfigPath(): string {
	return `${paths.config}/config.json`;
}

export function getDataDir(): string {
	return paths.data;
}

export function getDbPath(): string {
	return `${paths.data}/gspend.db`;
}

export function ensurePaths(): void {
	mkdirSync(paths.config, { recursive: true });
	mkdirSync(paths.data, { recursive: true });
}
