import { describe, expect, it } from 'vitest';
import type { Config } from '../../config.js';
import type { ProjectWithBilling } from '../../gcp/projects.js';
import { categorizeProjects } from './useProjectsData.js';

const baseConfig: Config = {
	projects: [
		{ projectId: 'tracked-1', billingAccountId: '111-AAA' },
		{ projectId: 'tracked-2', billingAccountId: '111-AAA' },
	],
	bigquery: { projectId: 'tracked-1', datasetId: 'billing' },
	currency: 'USD',
	pollInterval: 300,
};

const discovered: ProjectWithBilling[] = [
	{
		projectId: 'tracked-1',
		displayName: 'Tracked One',
		billingAccountId: '111-AAA',
		billingEnabled: true,
	},
	{
		projectId: 'tracked-2',
		displayName: 'Tracked Two',
		billingAccountId: '111-AAA',
		billingEnabled: true,
	},
	{
		projectId: 'untracked-same',
		displayName: 'Untracked Same Account',
		billingAccountId: '111-AAA',
		billingEnabled: true,
	},
	{
		projectId: 'other-account',
		displayName: 'Other Account',
		billingAccountId: '222-BBB',
		billingEnabled: true,
	},
	{
		projectId: 'no-billing',
		displayName: 'No Billing',
		billingAccountId: null,
		billingEnabled: false,
	},
];

describe('categorizeProjects', () => {
	it('marks tracked projects correctly', () => {
		const result = categorizeProjects(discovered, baseConfig);
		const tracked = result.filter((p) => p.tracked);
		expect(tracked).toHaveLength(2);
		expect(tracked.map((p) => p.projectId)).toEqual(['tracked-1', 'tracked-2']);
	});

	it('marks untracked projects with same billing account as canTrack', () => {
		const result = categorizeProjects(discovered, baseConfig);
		const canTrack = result.filter((p) => !p.tracked && p.canTrack);
		expect(canTrack).toHaveLength(1);
		expect(canTrack[0]?.projectId).toBe('untracked-same');
	});

	it('marks projects with different billing account as not canTrack', () => {
		const result = categorizeProjects(discovered, baseConfig);
		const other = result.filter((p) => !p.tracked && !p.canTrack);
		expect(other).toHaveLength(1);
		expect(other[0]?.projectId).toBe('other-account');
	});

	it('excludes projects with billing disabled', () => {
		const result = categorizeProjects(discovered, baseConfig);
		const ids = result.map((p) => p.projectId);
		expect(ids).not.toContain('no-billing');
	});

	it('uses discovered billing accounts when config lacks billingAccountId', () => {
		const configWithoutBilling: Config = {
			...baseConfig,
			projects: [{ projectId: 'tracked-1' }],
		};
		const result = categorizeProjects(discovered, configWithoutBilling);
		const untracked = result.find((p) => p.projectId === 'untracked-same');
		expect(untracked?.canTrack).toBe(true);
	});

	it('returns empty array for empty discovered list', () => {
		const result = categorizeProjects([], baseConfig);
		expect(result).toEqual([]);
	});

	it('marks projects as canTrack when their billing account has a billingExports entry', () => {
		const configWithExport: Config = {
			...baseConfig,
			billingExports: {
				'222-BBB': { projectId: 'other-bq-proj', datasetId: 'billing_ds' },
			},
		};
		const result = categorizeProjects(discovered, configWithExport);
		const otherAccount = result.find((p) => p.projectId === 'other-account');
		expect(otherAccount?.canTrack).toBe(true);
	});
});
