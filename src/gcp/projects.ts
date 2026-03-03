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

		// Phase 1: Collect all active projects (async iterator, no billing calls yet)
		const rawProjects: Array<{ projectId: string; displayName: string }> = [];
		const iterable = projectsClient.searchProjectsAsync({});
		for await (const project of iterable) {
			if (!project.projectId || project.state !== 'ACTIVE') continue;
			rawProjects.push({
				projectId: project.projectId,
				displayName: project.displayName ?? project.projectId,
			});
		}

		// Phase 2: Fetch billing info in parallel (batched, concurrency 10)
		const BATCH_SIZE = 10;
		const projects: ProjectWithBilling[] = [];

		for (let i = 0; i < rawProjects.length; i += BATCH_SIZE) {
			const batch = rawProjects.slice(i, i + BATCH_SIZE);
			const results = await Promise.allSettled(
				batch.map(async (p) => {
					try {
						const [billingInfo] = await billingClient.getProjectBillingInfo({
							name: `projects/${p.projectId}`,
						});
						return {
							...p,
							billingEnabled: billingInfo.billingEnabled ?? false,
							billingAccountId: billingInfo.billingAccountName
								? billingInfo.billingAccountName.replace('billingAccounts/', '')
								: null,
						};
					} catch {
						return { ...p, billingEnabled: false, billingAccountId: null };
					}
				}),
			);

			for (const result of results) {
				if (result.status === 'fulfilled') {
					projects.push(result.value);
				}
			}
		}

		return projects;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);

		if (msg.includes('has not been used in project') || msg.includes('it is disabled')) {
			const urlMatch = msg.match(/https:\/\/console\.developers\.google\.com\S+/);
			const enableUrl = urlMatch?.[0];
			throw new ApiError(
				'Cloud Resource Manager API is not enabled in your project.',
				undefined,
				enableUrl
					? `Enable it at: ${enableUrl}\nOr run: gcloud services enable cloudresourcemanager.googleapis.com`
					: 'Run: gcloud services enable cloudresourcemanager.googleapis.com',
			);
		}

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

		if (msg.includes('has not been used in project') || msg.includes('it is disabled')) {
			const urlMatch = msg.match(/https:\/\/console\.developers\.google\.com\S+/);
			const enableUrl = urlMatch?.[0];
			throw new ApiError(
				'Cloud Billing API is not enabled in your project.',
				undefined,
				enableUrl
					? `Enable it at: ${enableUrl}\nOr run: gcloud services enable cloudbilling.googleapis.com`
					: 'Run: gcloud services enable cloudbilling.googleapis.com',
			);
		}

		throw new ApiError(
			`Failed to list billing accounts: ${msg}`,
			undefined,
			'Ensure you have billing.accounts.list permission.',
		);
	}
}
