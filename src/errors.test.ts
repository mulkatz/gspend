import { describe, expect, it } from 'vitest';
import {
	ApiError,
	AuthError,
	BigQueryError,
	ConfigError,
	GspendError,
	PermissionError,
} from './errors.js';

describe('GspendError', () => {
	it('extends Error with optional hint', () => {
		const err = new GspendError('something failed', 'try this');
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(GspendError);
		expect(err.message).toBe('something failed');
		expect(err.hint).toBe('try this');
		expect(err.name).toBe('GspendError');
	});

	it('allows hint to be omitted', () => {
		const err = new GspendError('no hint');
		expect(err.hint).toBeUndefined();
	});
});

describe('AuthError', () => {
	it('has a default hint for gcloud auth', () => {
		const err = new AuthError('not authenticated');
		expect(err).toBeInstanceOf(GspendError);
		expect(err.name).toBe('AuthError');
		expect(err.hint).toBe('Run: gcloud auth application-default login');
	});

	it('allows overriding the hint', () => {
		const err = new AuthError('custom', 'custom hint');
		expect(err.hint).toBe('custom hint');
	});
});

describe('PermissionError', () => {
	it('tracks missing permissions', () => {
		const err = new PermissionError('denied', ['billing.viewer', 'bigquery.user']);
		expect(err).toBeInstanceOf(GspendError);
		expect(err.name).toBe('PermissionError');
		expect(err.missingPermissions).toEqual(['billing.viewer', 'bigquery.user']);
	});

	it('defaults to empty permissions array', () => {
		const err = new PermissionError('denied');
		expect(err.missingPermissions).toEqual([]);
	});
});

describe('ConfigError', () => {
	it('has a default hint for gspend init', () => {
		const err = new ConfigError('no config');
		expect(err).toBeInstanceOf(GspendError);
		expect(err.name).toBe('ConfigError');
		expect(err.hint).toBe('Run: gspend init');
	});
});

describe('ApiError', () => {
	it('tracks HTTP status code', () => {
		const err = new ApiError('rate limited', 429, 'retry later');
		expect(err).toBeInstanceOf(GspendError);
		expect(err.name).toBe('ApiError');
		expect(err.statusCode).toBe(429);
		expect(err.hint).toBe('retry later');
	});

	it('allows statusCode to be omitted', () => {
		const err = new ApiError('unknown error');
		expect(err.statusCode).toBeUndefined();
	});
});

describe('BigQueryError', () => {
	it('has a default hint about billing export', () => {
		const err = new BigQueryError('table not found');
		expect(err).toBeInstanceOf(GspendError);
		expect(err.name).toBe('BigQueryError');
		expect(err.hint).toContain('billing export');
	});
});
