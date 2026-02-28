import chalk from 'chalk';
import Table from 'cli-table3';
import type { ServiceBreakdown, SkuBreakdown } from '../gcp/bigquery.js';
import type { ProjectWithBilling } from '../gcp/projects.js';
import type { BudgetStatus } from '../tracker/budget.js';
import type { CostStatus } from '../tracker/costs.js';
import { budgetGauge } from './chart.js';
import { budgetColor, currency, percentStr, trendIcon } from './colors.js';

export function statusTable(
	status: CostStatus,
	budgetStatus?: BudgetStatus | null | undefined,
): string {
	const table = new Table({
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
	});

	table.push(
		[chalk.dim('Today'), currency(status.today, status.currency)],
		[chalk.dim('This Week'), currency(status.thisWeek, status.currency)],
		[
			chalk.dim('This Month'),
			`${currency(status.netMonth, status.currency)} ${chalk.dim(`(gross: ${currency(status.thisMonth, status.currency)})`)}`,
		],
		[
			chalk.dim('Forecast'),
			`${currency(status.forecast, status.currency)} ${chalk.dim('end of month')}`,
		],
		[
			chalk.dim('Trend'),
			`${trendIcon(status.trend.direction)} ${status.trend.percentChange > 0 ? '+' : ''}${percentStr(status.trend.percentChange)} vs last week`,
		],
	);

	if (budgetStatus) {
		table.push([
			chalk.dim('Budget'),
			`${budgetGauge(budgetStatus.percentage, 20)} ${budgetColor(budgetStatus.percentage)(percentStr(budgetStatus.percentage))} of ${currency(budgetStatus.budget, status.currency)}`,
		]);
	}

	let output = table.toString();

	if (status.topServices.length > 0) {
		output += `\n\n${chalk.bold('Top Services')}`;
		const serviceTable = new Table({
			head: [chalk.dim('Service'), chalk.dim('Amount'), chalk.dim('%')],
			chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
		});
		for (const s of status.topServices) {
			serviceTable.push([s.service, currency(s.amount, s.currency), percentStr(s.percentage)]);
		}
		output += `\n${serviceTable.toString()}`;
	}

	return output;
}

export function breakdownTable(items: (ServiceBreakdown | SkuBreakdown)[]): string {
	const first = items[0];
	const isSkuLevel = first !== undefined && 'description' in first;

	const head = isSkuLevel
		? [chalk.dim('SKU'), chalk.dim('Description'), chalk.dim('Amount'), chalk.dim('%')]
		: [chalk.dim('Service'), chalk.dim('Amount'), chalk.dim('%')];

	const table = new Table({
		head,
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
	});

	for (const item of items) {
		if ('description' in item) {
			table.push([
				item.sku,
				item.description,
				currency(item.amount, item.currency),
				percentStr(item.percentage),
			]);
		} else {
			table.push([item.service, currency(item.amount, item.currency), percentStr(item.percentage)]);
		}
	}

	const total = items.reduce((sum, i) => sum + i.amount, 0);
	const cur = items[0]?.currency ?? 'USD';

	if (isSkuLevel) {
		table.push([chalk.bold('Total'), '', chalk.bold(currency(total, cur)), '']);
	} else {
		table.push([chalk.bold('Total'), chalk.bold(currency(total, cur)), '']);
	}

	return table.toString();
}

export function projectsTable(projects: ProjectWithBilling[]): string {
	const table = new Table({
		head: [
			chalk.dim('Project ID'),
			chalk.dim('Name'),
			chalk.dim('Billing Account'),
			chalk.dim('Billing'),
		],
		chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
	});

	for (const p of projects) {
		table.push([
			p.projectId,
			p.displayName,
			p.billingAccountId ?? chalk.dim('none'),
			p.billingEnabled ? chalk.green('enabled') : chalk.red('disabled'),
		]);
	}

	return table.toString();
}
