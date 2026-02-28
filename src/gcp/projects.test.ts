import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors.js';

const mockSearchProjectsAsync = vi.fn();
const mockGetProjectBillingInfo = vi.fn();
const mockListBillingAccounts = vi.fn();

vi.mock('@google-cloud/resource-manager', () => ({
	ProjectsClient: class {
		searchProjectsAsync = mockSearchProjectsAsync;
	},
}));

vi.mock('@google-cloud/billing', () => ({
	CloudBillingClient: class {
		getProjectBillingInfo = mockGetProjectBillingInfo;
		listBillingAccounts = mockListBillingAccounts;
	},
}));

const { discoverProjects, listBillingAccounts } = await import('./projects.js');

async function* asyncGenerator<T>(items: T[]): AsyncGenerator<T> {
	for (const item of items) yield item;
}

describe('discoverProjects', () => {
	it('maps projects with billing info', async () => {
		mockSearchProjectsAsync.mockReturnValue(
			asyncGenerator([{ projectId: 'proj-1', displayName: 'Project One', state: 'ACTIVE' }]),
		);
		mockGetProjectBillingInfo.mockResolvedValue([
			{
				billingEnabled: true,
				billingAccountName: 'billingAccounts/ABC-123',
			},
		]);

		const projects = await discoverProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.projectId).toBe('proj-1');
		expect(projects[0]?.billingEnabled).toBe(true);
		expect(projects[0]?.billingAccountId).toBe('ABC-123');
	});

	it('skips inactive projects', async () => {
		mockSearchProjectsAsync.mockReturnValue(
			asyncGenerator([
				{ projectId: 'deleted', state: 'DELETE_REQUESTED' },
				{ projectId: 'active', displayName: 'Active', state: 'ACTIVE' },
			]),
		);
		mockGetProjectBillingInfo.mockResolvedValue([{ billingEnabled: false }]);

		const projects = await discoverProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.projectId).toBe('active');
	});

	it('handles billing info errors gracefully', async () => {
		mockSearchProjectsAsync.mockReturnValue(
			asyncGenerator([{ projectId: 'proj-1', state: 'ACTIVE' }]),
		);
		mockGetProjectBillingInfo.mockRejectedValue(new Error('no access'));

		const projects = await discoverProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.billingEnabled).toBe(false);
		expect(projects[0]?.billingAccountId).toBeNull();
	});
});

describe('listBillingAccounts', () => {
	it('returns billing accounts', async () => {
		mockListBillingAccounts.mockResolvedValue([
			[
				{ name: 'billingAccounts/ABC', displayName: 'Main', open: true },
				{ name: 'billingAccounts/DEF', displayName: 'Old', open: false },
			],
		]);

		const accounts = await listBillingAccounts();
		expect(accounts).toHaveLength(2);
		expect(accounts[0]?.open).toBe(true);
		expect(accounts[1]?.open).toBe(false);
	});

	it('throws ApiError on failure', async () => {
		mockListBillingAccounts.mockRejectedValue(new Error('unauthorized'));

		await expect(listBillingAccounts()).rejects.toThrow(ApiError);
	});
});
