import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors.js';

const mockListBudgets = vi.fn();
const mockCreateBudget = vi.fn();
const mockUpdateBudget = vi.fn();

vi.mock('@google-cloud/billing-budgets', () => ({
	BudgetServiceClient: class {
		listBudgets = mockListBudgets;
		createBudget = mockCreateBudget;
		updateBudget = mockUpdateBudget;
	},
}));

const { listBudgets, createBudget, updateBudget } = await import('./budgets.js');

describe('listBudgets', () => {
	it('maps budget response to Budget interface', async () => {
		mockListBudgets.mockResolvedValue([
			[
				{
					name: 'budgets/123',
					displayName: 'Monthly Limit',
					amount: { specifiedAmount: { units: '100', currencyCode: 'USD' } },
					thresholdRules: [{ thresholdPercent: 0.5 }, { thresholdPercent: 0.8 }],
				},
			],
		]);

		const budgets = await listBudgets('ABC-123');
		expect(budgets).toHaveLength(1);
		expect(budgets[0]?.amount).toBe(100);
		expect(budgets[0]?.thresholds).toEqual([50, 80]);
	});

	it('throws ApiError on failure', async () => {
		mockListBudgets.mockRejectedValue(new Error('forbidden'));
		await expect(listBudgets('ABC')).rejects.toThrow(ApiError);
	});
});

describe('createBudget', () => {
	it('creates a budget and returns it', async () => {
		mockCreateBudget.mockResolvedValue([{ name: 'budgets/456', displayName: 'New Budget' }]);

		const budget = await createBudget('ABC-123', 'New Budget', 200, 'USD', [50, 80, 100]);
		expect(budget.amount).toBe(200);
		expect(budget.thresholds).toEqual([50, 80, 100]);
	});

	it('throws ApiError on failure', async () => {
		mockCreateBudget.mockRejectedValue(new Error('denied'));
		await expect(createBudget('ABC', 'test', 100, 'USD', [50])).rejects.toThrow(ApiError);
	});
});

describe('updateBudget', () => {
	it('updates budget amount and thresholds', async () => {
		mockUpdateBudget.mockResolvedValue([{ name: 'budgets/456', displayName: 'Updated' }]);

		const budget = await updateBudget('budgets/456', 300, 'EUR', [80, 100]);
		expect(budget.amount).toBe(300);
		expect(budget.currency).toBe('EUR');
	});
});
