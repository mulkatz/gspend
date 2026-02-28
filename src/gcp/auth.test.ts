import { describe, expect, it, vi } from 'vitest';
import { AuthError, PermissionError } from '../errors.js';

const mockGetClient = vi.fn();
const mockGetProjectId = vi.fn();
const mockTestIamPermissions = vi.fn();

vi.mock('google-auth-library', () => ({
	GoogleAuth: class {
		getClient = mockGetClient;
		getProjectId = mockGetProjectId;
	},
}));

vi.mock('@google-cloud/billing', () => ({
	CloudBillingClient: class {
		testIamPermissions = mockTestIamPermissions;
	},
}));

const { validateCredentials, checkBillingPermissions } = await import('./auth.js');

describe('validateCredentials', () => {
	it('returns credentials on success', async () => {
		mockGetClient.mockResolvedValue({
			getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
			credentials: { client_email: 'test@example.com' },
		});
		mockGetProjectId.mockResolvedValue('my-project');

		const creds = await validateCredentials();
		expect(creds.email).toBe('test@example.com');
		expect(creds.projectId).toBe('my-project');
	});

	it('throws AuthError when no token received', async () => {
		mockGetClient.mockResolvedValue({
			getAccessToken: vi.fn().mockResolvedValue({ token: null }),
			credentials: {},
		});
		mockGetProjectId.mockResolvedValue(null);

		await expect(validateCredentials()).rejects.toThrow(AuthError);
	});

	it('throws AuthError when ADC not configured', async () => {
		mockGetClient.mockRejectedValue(new Error('not found'));
		mockGetProjectId.mockRejectedValue(new Error('not found'));

		await expect(validateCredentials()).rejects.toThrow(AuthError);
	});
});

describe('checkBillingPermissions', () => {
	it('returns granted and missing permissions', async () => {
		mockTestIamPermissions.mockResolvedValue([{ permissions: ['billing.accounts.get'] }]);

		const result = await checkBillingPermissions('billingAccounts/123');
		expect(result.granted).toEqual(['billing.accounts.get']);
		expect(result.missing).toContain('billing.accounts.list');
	});

	it('returns all as granted when all permissions present', async () => {
		mockTestIamPermissions.mockResolvedValue([
			{
				permissions: [
					'billing.accounts.get',
					'billing.accounts.list',
					'billing.resourceAssociations.list',
				],
			},
		]);

		const result = await checkBillingPermissions('billingAccounts/123');
		expect(result.missing).toEqual([]);
	});

	it('throws PermissionError on API failure', async () => {
		mockTestIamPermissions.mockRejectedValue(new Error('forbidden'));

		await expect(checkBillingPermissions('billingAccounts/123')).rejects.toThrow(PermissionError);
	});
});
