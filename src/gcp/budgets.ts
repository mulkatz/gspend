import { BudgetServiceClient } from '@google-cloud/billing-budgets';
import { ApiError } from '../errors.js';

export interface Budget {
	name: string;
	displayName: string;
	amount: number;
	currency: string;
	thresholds: number[];
}

export async function listBudgets(billingAccountId: string): Promise<Budget[]> {
	try {
		const client = new BudgetServiceClient();
		const parent = `billingAccounts/${billingAccountId}`;
		const [budgets] = await client.listBudgets({ parent });

		return budgets.map((b) => ({
			name: b.name ?? '',
			displayName: b.displayName ?? '',
			amount: Number(b.amount?.specifiedAmount?.units ?? 0),
			currency: b.amount?.specifiedAmount?.currencyCode ?? 'USD',
			thresholds: (b.thresholdRules ?? []).map((r) => (r.thresholdPercent ?? 0) * 100),
		}));
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new ApiError(
			`Failed to list budgets: ${msg}`,
			undefined,
			'Ensure you have billing.budgets.list permission.',
		);
	}
}

export async function createBudget(
	billingAccountId: string,
	displayName: string,
	amount: number,
	currency: string,
	thresholds: number[],
): Promise<Budget> {
	try {
		const client = new BudgetServiceClient();
		const parent = `billingAccounts/${billingAccountId}`;

		const [budget] = await client.createBudget({
			parent,
			budget: {
				displayName,
				amount: {
					specifiedAmount: {
						units: String(Math.floor(amount)),
						nanos: Math.round((amount % 1) * 1e9),
						currencyCode: currency,
					},
				},
				thresholdRules: thresholds.map((t) => ({
					thresholdPercent: t / 100,
					spendBasis: 'CURRENT_SPEND' as const,
				})),
			},
		});

		return {
			name: budget.name ?? '',
			displayName: budget.displayName ?? '',
			amount,
			currency,
			thresholds,
		};
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new ApiError(
			`Failed to create budget: ${msg}`,
			undefined,
			'Ensure you have billing.budgets.create permission.',
		);
	}
}

export async function updateBudget(
	budgetName: string,
	amount: number,
	currency: string,
	thresholds: number[],
): Promise<Budget> {
	try {
		const client = new BudgetServiceClient();

		const [budget] = await client.updateBudget({
			budget: {
				name: budgetName,
				amount: {
					specifiedAmount: {
						units: String(Math.floor(amount)),
						nanos: Math.round((amount % 1) * 1e9),
						currencyCode: currency,
					},
				},
				thresholdRules: thresholds.map((t) => ({
					thresholdPercent: t / 100,
					spendBasis: 'CURRENT_SPEND' as const,
				})),
			},
			updateMask: {
				paths: ['amount', 'threshold_rules'],
			},
		});

		return {
			name: budget.name ?? '',
			displayName: budget.displayName ?? '',
			amount,
			currency,
			thresholds,
		};
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new ApiError(
			`Failed to update budget: ${msg}`,
			undefined,
			'Ensure you have billing.budgets.update permission.',
		);
	}
}
