import { execFileSync } from 'node:child_process';
import * as readline from 'node:readline';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { type Config, type ProjectConfig, saveConfig } from '../../config.js';
import { GspendError } from '../../errors.js';
import {
	checkAdcFileExists,
	checkBillingPermissions,
	validateCredentials,
} from '../../gcp/auth.js';
import {
	type DiscoveredExport,
	discoverBillingExport,
	getDataFreshness,
} from '../../gcp/bigquery.js';
import { type BillingAccount, discoverProjects, listBillingAccounts } from '../../gcp/projects.js';
import { getConfigPath } from '../../paths.js';
import { closeDb, getDb } from '../../store/db.js';
import { formatFreshness } from '../../ui/freshness.js';
import { billingExportUrl, terminalLink } from '../../ui/links.js';

function checkGcloudInstalled(): boolean {
	try {
		execFileSync('which', ['gcloud'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

const WAIT_POLL_MS = 3000;
const WAIT_TIMEOUT_MS = 5 * 60 * 1000;

async function waitForCredentials(): Promise<{ email: string } | null> {
	const rl = readline.createInterface({ input: process.stdin });
	let cancelled = false;
	let enterPressed = false;

	const enterPromise = new Promise<void>((resolve) => {
		rl.once('line', () => {
			enterPressed = true;
			resolve();
		});
		rl.once('close', () => {
			cancelled = true;
			resolve();
		});
	});

	const startTime = Date.now();

	try {
		while (Date.now() - startTime < WAIT_TIMEOUT_MS) {
			if (cancelled) return null;

			if (enterPressed || checkAdcFileExists()) {
				try {
					const creds = await validateCredentials();
					return { email: creds.email };
				} catch {
					// Credentials exist but invalid/expired — keep waiting
					enterPressed = false;
				}
			}

			await Promise.race([
				new Promise<void>((resolve) => setTimeout(resolve, WAIT_POLL_MS)),
				enterPromise,
			]);
		}

		// Timeout
		return null;
	} finally {
		rl.close();
	}
}

export const initCommand = new Command('init')
	.description('Set up gspend for your GCP account')
	.action(async () => {
		p.intro(chalk.bold('gspend init'));

		// ─── Phase 0: Pre-flight checks ───
		p.log.step('Checking prerequisites...');

		const hasGcloud = checkGcloudInstalled();
		if (hasGcloud) {
			p.log.success('gcloud CLI found');
		}

		const hasEnvCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
		const hasAdc = checkAdcFileExists();

		let email: string;

		if (hasAdc) {
			// ADC file exists — try to validate it
			try {
				const creds = await validateCredentials();
				email = creds.email;
				p.log.success(`Authenticated as ${chalk.cyan(email)}`);
			} catch {
				// File exists but token expired/invalid
				p.log.warn('Credentials need refresh');
				p.log.info(
					`Run in another terminal:\n\n  ${chalk.cyan('gcloud auth application-default login')}`,
				);
				p.log.message(chalk.dim('Waiting for credentials... (press Enter to re-check)'));

				const result = await waitForCredentials();
				if (!result) {
					p.cancel('Setup cancelled.');
					return;
				}
				email = result.email;
				p.log.success(`Authenticated as ${chalk.cyan(email)}`);
			}
		} else if (hasGcloud || hasEnvCredentials) {
			// gcloud is installed but no ADC yet, or GOOGLE_APPLICATION_CREDENTIALS points to missing file
			p.log.warn('Application Default Credentials not found');
			p.log.info(
				[
					"gspend uses Google Cloud's default credentials to access",
					'your billing data. Run this in another terminal:',
					'',
					`  ${chalk.cyan('gcloud auth application-default login')}`,
					'',
					'This opens your browser for Google sign-in.',
					'Come back here when done.',
				].join('\n'),
			);
			p.log.message(chalk.dim('Waiting for credentials... (press Enter to re-check)'));

			const result = await waitForCredentials();
			if (!result) {
				p.cancel('Setup cancelled.');
				return;
			}
			email = result.email;
			p.log.success(`Authenticated as ${chalk.cyan(email)}`);
		} else {
			// No gcloud, no env var — hard stop
			p.log.error('gcloud CLI not found');
			p.log.info(
				[
					'gspend requires Google Cloud credentials. Install the gcloud CLI:',
					`  ${terminalLink('Google Cloud SDK', 'https://cloud.google.com/sdk/install')}`,
					'',
					'Or if you have a service account key:',
					`  ${chalk.cyan('export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json')}`,
					'',
					'Then run gspend init again.',
				].join('\n'),
			);
			process.exitCode = 1;
			return;
		}

		// ─── Phase 1: Discover billing accounts ───
		const billingSpinner = p.spinner();
		billingSpinner.start('Discovering billing accounts...');

		let billingAccountName: string | null = null;
		try {
			const accounts = await listBillingAccounts();
			const openAccounts = accounts.filter((a) => a.open);
			billingSpinner.stop(`Found ${openAccounts.length} billing account(s)`);

			if (openAccounts.length === 0) {
				p.log.error('No open billing accounts found.');
				p.outro(chalk.red('You need a billing account with viewer permissions.'));
				process.exitCode = 1;
				return;
			}

			if (openAccounts.length === 1) {
				billingAccountName = openAccounts[0]?.name ?? null;
				p.log.info(`Using billing account: ${chalk.cyan(openAccounts[0]?.displayName)}`);
			} else {
				const selected = await p.select({
					message: 'Select billing account:',
					options: openAccounts.map((a) => ({
						value: a.name,
						label: `${a.displayName} (${a.name})`,
					})),
				});
				if (p.isCancel(selected)) {
					p.cancel('Setup cancelled.');
					return;
				}
				billingAccountName = selected;
			}

			if (billingAccountName) {
				const permResult = await checkBillingPermissions(billingAccountName);
				if (permResult.missing.length > 0) {
					p.log.warn(`Missing permissions: ${permResult.missing.join(', ')}`);
					p.log.info(chalk.dim('Grant the Billing Account Viewer role to your account.'));
				}
			}
		} catch (error) {
			billingSpinner.stop(chalk.red('Failed to discover billing accounts'));
			const msg = error instanceof GspendError ? (error.hint ?? error.message) : String(error);
			p.log.error(msg);
			p.outro(chalk.red('Fix permissions and try again.'));
			process.exitCode = 1;
			return;
		}

		// ─── Phase 2: Discover projects ───
		const projSpinner = p.spinner();
		projSpinner.start('Discovering GCP projects...');

		let allProjects: Awaited<ReturnType<typeof discoverProjects>>;
		try {
			allProjects = await discoverProjects();
			const billingProjects = allProjects.filter((pr) => pr.billingEnabled);
			projSpinner.stop(`Found ${billingProjects.length} project(s) with billing enabled`);

			if (billingProjects.length === 0) {
				p.log.error('No projects with billing enabled found.');
				p.outro(chalk.red('Enable billing on at least one project.'));
				process.exitCode = 1;
				return;
			}
		} catch (error) {
			projSpinner.stop(chalk.red('Failed to discover projects'));
			const msg = error instanceof GspendError ? (error.hint ?? error.message) : String(error);
			p.log.error(msg);
			p.outro(chalk.red('Fix permissions and try again.'));
			process.exitCode = 1;
			return;
		}

		const billingProjects = allProjects.filter((pr) => pr.billingEnabled);

		const selectedProjects = await p.multiselect({
			message: 'Select projects to track:',
			options: billingProjects.map((pr) => ({
				value: pr.projectId,
				label: `${pr.displayName} (${pr.projectId})`,
			})),
			required: true,
		});

		if (p.isCancel(selectedProjects)) {
			p.cancel('Setup cancelled.');
			return;
		}

		// ─── Phase 3: Auto-discover BigQuery billing export ───
		const discoverySpinner = p.spinner();
		discoverySpinner.start('Scanning projects for existing billing export...');

		let discovered: DiscoveredExport | null = null;
		try {
			discovered = await discoverBillingExport(selectedProjects);
		} catch {
			// Discovery is best-effort
		}

		if (discovered) {
			discoverySpinner.stop(
				`Found billing export: ${chalk.cyan(`${discovered.projectId}.${discovered.datasetId}.${discovered.tableId}`)}`,
			);
		} else {
			discoverySpinner.stop(chalk.yellow('No billing export found'));

			const accountProjects = new Map<string, { account: BillingAccount; projectIds: string[] }>();
			const openAccounts = (await listBillingAccounts()).filter((a) => a.open);
			for (const projectId of selectedProjects) {
				const proj = billingProjects.find((pr) => pr.projectId === projectId);
				const accountId = proj?.billingAccountId ?? 'unknown';
				if (!accountProjects.has(accountId)) {
					const account = openAccounts.find((a) => a.name === `billingAccounts/${accountId}`) ?? {
						name: `billingAccounts/${accountId}`,
						displayName: accountId,
						open: true,
					};
					accountProjects.set(accountId, { account, projectIds: [] });
				}
				accountProjects.get(accountId)?.projectIds.push(projectId);
			}

			const exportStatus = new Map<string, DiscoveredExport | null>();
			for (const accountId of accountProjects.keys()) {
				exportStatus.set(accountId, null);
			}

			function renderTable(): string {
				const lines: string[] = [];
				lines.push('');
				lines.push(chalk.yellow('  \u26A0 No billing export configured yet.'));
				lines.push('');
				lines.push('  Enable BigQuery billing export for each billing account:');
				lines.push('');

				const header = `  ${'Billing Account'.padEnd(30)} ${'Console'.padEnd(28)} Export`;
				lines.push(header);
				lines.push(`  ${'\u2500'.repeat(67)}`);

				for (const [accountId, { account, projectIds }] of accountProjects) {
					const status = exportStatus.get(accountId);
					const statusIcon = status ? chalk.green('\u2713') : chalk.red('\u2717');
					const displayName = `${account.displayName} (${accountId.slice(0, 12)})`;
					const url = billingExportUrl(accountId);
					const link = terminalLink('\u2192 Open Console', url);

					lines.push(`  ${displayName.padEnd(30)} ${link.padEnd(28)} ${statusIcon}`);
					for (let i = 0; i < projectIds.length; i++) {
						const prefix = i === projectIds.length - 1 ? '\u2514' : '\u251C';
						lines.push(chalk.dim(`    ${prefix} ${projectIds[i]}`));
					}
				}

				lines.push(`  ${'\u2500'.repeat(67)}`);
				lines.push('');
				lines.push('  Steps: 1. Click "Open Console" above');
				lines.push('         2. Select "Standard usage cost" export');
				lines.push('         3. Choose any project and dataset (or create one)');
				lines.push('');

				const allDone = [...exportStatus.values()].every((v) => v !== null);
				if (allDone) {
					lines.push(chalk.green('  All billing exports configured!'));
				} else {
					lines.push(
						chalk.dim('  Refreshing every 5s... Press Enter to continue without waiting.'),
					);
				}

				return lines.join('\n');
			}

			async function pollExports(): Promise<void> {
				for (const [accountId, { projectIds }] of accountProjects) {
					if (exportStatus.get(accountId)) continue;

					for (const projectId of projectIds) {
						const found = await discoverBillingExport([projectId]);
						if (found) {
							exportStatus.set(accountId, found);
							break;
						}
					}
				}
			}

			let enterPressed = false;

			const rl = readline.createInterface({ input: process.stdin });
			const enterPromise = new Promise<void>((resolve) => {
				rl.once('line', () => {
					enterPressed = true;
					resolve();
				});
			});

			process.stdout.write('\x1B[2J\x1B[H');
			console.log(chalk.bold('gspend init') + chalk.dim(' \u2014 Billing Export Setup\n'));
			console.log(renderTable());

			try {
				for (let i = 0; i < 60; i++) {
					const allDone = [...exportStatus.values()].every((v) => v !== null);
					if (allDone || enterPressed) break;

					await Promise.race([
						new Promise<void>((resolve) => setTimeout(resolve, 5000)),
						enterPromise,
					]);

					if (enterPressed) break;

					await pollExports();

					process.stdout.write('\x1B[2J\x1B[H');
					console.log(chalk.bold('gspend init') + chalk.dim(' \u2014 Billing Export Setup\n'));
					console.log(renderTable());
				}
			} finally {
				rl.close();
			}

			for (const status of exportStatus.values()) {
				if (status) {
					discovered = status;
					break;
				}
			}

			if (discovered) {
				p.log.success(
					`Export found: ${chalk.cyan(`${discovered.projectId}.${discovered.datasetId}.${discovered.tableId}`)}`,
				);
			} else {
				p.log.info('Continuing without billing export. Run `gspend status` later to auto-detect.');
			}
		}

		const bqProject = discovered?.projectId ?? selectedProjects[0] ?? '';
		const bqDataset = discovered?.datasetId ?? '';
		const discoveredTableId = discovered?.tableId;

		// ─── Phase 4: Budget configuration ───
		const projectConfigs: ProjectConfig[] = [];
		for (const projectId of selectedProjects) {
			const proj = billingProjects.find((pr) => pr.projectId === projectId);

			const budgetInput = await p.text({
				message: `Monthly budget for ${projectId} (leave empty to skip):`,
				initialValue: '',
			});

			if (p.isCancel(budgetInput)) {
				p.cancel('Setup cancelled.');
				return;
			}

			const budget = budgetInput ? Number.parseFloat(budgetInput) : undefined;
			const billingAccountId =
				proj?.billingAccountId ?? billingAccountName?.replace('billingAccounts/', '') ?? undefined;

			projectConfigs.push({
				projectId,
				displayName: proj?.displayName,
				billingAccountId,
				monthlyBudget: budget && !Number.isNaN(budget) ? budget : undefined,
				budgetWarnPercent: budget ? 80 : undefined,
			});
		}

		// ─── Phase 5: Write config ───
		const config: Config = {
			projects: projectConfigs,
			bigquery: {
				projectId: bqProject,
				datasetId: bqDataset,
				tableId: discoveredTableId,
			},
			currency: 'USD',
			pollInterval: 300,
		};

		saveConfig(config);
		p.log.success(`Config saved to ${chalk.dim(getConfigPath())}`);

		// ─── Phase 6: Initialize database ───
		const dbSpinner = p.spinner();
		dbSpinner.start('Initializing local database...');
		getDb();
		closeDb();
		dbSpinner.stop('Database initialized');

		// ─── Phase 7: Verification ───
		if (discovered?.tableId) {
			const verifySpinner = p.spinner();
			verifySpinner.start('Verifying setup...');
			try {
				const freshness = await getDataFreshness(bqProject, bqDataset, discovered.tableId);
				verifySpinner.stop('Setup verified');
				p.log.success(`BigQuery connection OK — ${formatFreshness(freshness)}`);
			} catch {
				verifySpinner.stop(chalk.yellow('Could not verify BigQuery access'));
				p.log.info(chalk.dim('Run `gspend status` later to check connectivity.'));
			}
		}

		p.outro(chalk.green('gspend is ready! Run `gspend status` to see your spending.'));
	});
