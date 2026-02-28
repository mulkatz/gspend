import type { ProjectConfig } from '../config.js';

export interface BudgetStatus {
	budget: number;
	spent: number;
	percentage: number;
	remaining: number;
	level: 'ok' | 'warn' | 'critical' | 'exceeded';
}

export interface ThresholdAlert {
	threshold: number;
	percentage: number;
	message: string;
}

export function getBudgetStatus(project: ProjectConfig, monthlySpend: number): BudgetStatus | null {
	if (!project.monthlyBudget) return null;

	const budget = project.monthlyBudget;
	const percentage = (monthlySpend / budget) * 100;
	const remaining = budget - monthlySpend;

	let level: BudgetStatus['level'];
	if (percentage >= 100) level = 'exceeded';
	else if (percentage >= 80) level = 'critical';
	else if (percentage >= 50) level = 'warn';
	else level = 'ok';

	return { budget, spent: monthlySpend, percentage, remaining, level };
}

const DEFAULT_THRESHOLDS = [50, 80, 100];

export function checkThresholds(project: ProjectConfig, spend: number): ThresholdAlert[] {
	if (!project.monthlyBudget) return [];

	const percentage = (spend / project.monthlyBudget) * 100;
	const thresholds = DEFAULT_THRESHOLDS;
	const warnPercent = project.budgetWarnPercent ?? 80;

	return thresholds
		.filter((t) => percentage >= t)
		.map((threshold) => ({
			threshold,
			percentage,
			message:
				threshold >= 100
					? `Budget exceeded! ${percentage.toFixed(1)}% of $${project.monthlyBudget}/mo`
					: threshold >= warnPercent
						? `Warning: ${percentage.toFixed(1)}% of monthly budget used`
						: `${percentage.toFixed(1)}% of monthly budget used`,
		}));
}
