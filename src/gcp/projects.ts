import { CloudBillingClient } from '@google-cloud/billing';
import { ProjectsClient } from '@google-cloud/resource-manager';
import { ApiError } from '../errors.js';

export interface ProjectWithBilling {
	projectId: string;
	displayName: string;
	billingAccountId: string | null;
	billingEnabled: boolean;
}

export interface BillingAccount {
	name: string;
	displayName: string;
	open: boolean;
}

export async function discoverProjects(): Promise<ProjectWithBilling[]> {
	try {
		const projectsClient = new ProjectsClient();
		const billingClient = new CloudBillingClient();

		const projects: ProjectWithBilling[] = [];

		const iterable = projectsClient.searchProjectsAsync({});
		for await (const project of iterable) {
			if (!project.projectId || project.state !== 'ACTIVE') continue;

			let billingAccountId: string | null = null;
			let billingEnabled = false;

			try {
				const [billingInfo] = await billingClient.getProjectBillingInfo({
					name: `projects/${project.projectId}`,
				});
				billingEnabled = billingInfo.billingEnabled ?? false;
				billingAccountId = billingInfo.billingAccountName
					? billingInfo.billingAccountName.replace('billingAccounts/', '')
					: null;
			} catch {
				// No billing access for this project — skip billing info
			}

			projects.push({
				projectId: project.projectId,
				displayName: project.displayName ?? project.projectId,
				billingAccountId,
				billingEnabled,
			});
		}

		return projects;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new ApiError(
			`Failed to discover projects: ${msg}`,
			undefined,
			'Ensure you have resourcemanager.projects.list permission.',
		);
	}
}

export async function listBillingAccounts(): Promise<BillingAccount[]> {
	try {
		const client = new CloudBillingClient();
		const [accounts] = await client.listBillingAccounts({});

		return accounts.map((a) => ({
			name: a.name ?? '',
			displayName: a.displayName ?? '',
			open: a.open ?? false,
		}));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new ApiError(
			`Failed to list billing accounts: ${msg}`,
			undefined,
			'Ensure you have billing.accounts.list permission.',
		);
	}
}
