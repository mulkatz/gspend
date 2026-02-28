import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CloudBillingClient } from '@google-cloud/billing';
import { GoogleAuth } from 'google-auth-library';
import { AuthError, PermissionError } from '../errors.js';

/**
 * Check if Application Default Credentials exist on disk (env var or gcloud default location).
 * Never throws — returns true/false.
 */
export function checkAdcFileExists(): boolean {
	// 1. Explicit env var
	const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
	if (envPath) {
		return fs.existsSync(envPath);
	}
	// 2. Default gcloud ADC location
	const defaultPath = path.join(
		os.homedir(),
		'.config',
		'gcloud',
		'application_default_credentials.json',
	);
	return fs.existsSync(defaultPath);
}

export interface Credentials {
	email: string;
	projectId: string | null;
}

export async function validateCredentials(): Promise<Credentials> {
	try {
		const auth = new GoogleAuth({
			scopes: ['https://www.googleapis.com/auth/cloud-platform'],
		});
		const client = await auth.getClient();
		const projectId = await auth.getProjectId();
		const tokenInfo = await client.getAccessToken();

		if (!tokenInfo.token) {
			throw new AuthError('No access token received.');
		}

		// Try to get email from credentials (works for service accounts)
		const credentials = client.credentials;
		let email = (credentials as { client_email?: string }).client_email;

		// For user ADC (OAuth2), resolve email from tokeninfo endpoint
		if (!email && tokenInfo.token) {
			try {
				const resp = await fetch(
					`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${tokenInfo.token}`,
				);
				if (resp.ok) {
					const info = (await resp.json()) as { email?: string };
					email = info.email;
				}
			} catch {
				// Best-effort — fall through to fallback
			}
		}

		return { email: email ?? 'authenticated-user', projectId };
	} catch (error) {
		if (error instanceof AuthError) throw error;
		throw new AuthError(
			'Application Default Credentials not configured.',
			'Run: gcloud auth application-default login',
		);
	}
}

const REQUIRED_BILLING_PERMISSIONS = [
	'billing.accounts.get',
	'billing.accounts.list',
	'billing.resourceAssociations.list',
];

export async function checkBillingPermissions(
	billingAccountName: string,
): Promise<{ granted: string[]; missing: string[] }> {
	try {
		const client = new CloudBillingClient();
		const [response] = await client.testIamPermissions({
			resource: billingAccountName,
			permissions: REQUIRED_BILLING_PERMISSIONS,
		});

		const granted = response.permissions ?? [];
		const missing = REQUIRED_BILLING_PERMISSIONS.filter((p) => !granted.includes(p));

		return { granted, missing };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new PermissionError(
			`Cannot check billing permissions: ${msg}`,
			REQUIRED_BILLING_PERMISSIONS,
			`Ensure your account has Billing Account Viewer role on ${billingAccountName}`,
		);
	}
}

export async function checkBigQueryAccess(projectId: string, datasetId: string): Promise<boolean> {
	try {
		const { BigQuery } = await import('@google-cloud/bigquery');
		const bq = new BigQuery({ projectId });
		await bq.dataset(datasetId).getTables({ maxResults: 1 });
		return true;
	} catch {
		return false;
	}
}
