import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface Column<T> {
	title: string;
	key: keyof T & string;
	width?: number;
	align?: 'left' | 'right';
	render?: (value: T[keyof T], row: T) => string;
}

interface TableProps<T> {
	columns: Column<T>[];
	data: T[];
	selectedIndex?: number;
	rowKey?: keyof T & string;
}

export function Table<T extends Record<string, unknown>>({
	columns,
	data,
	selectedIndex,
	rowKey,
}: TableProps<T>): ReactNode {
	return (
		<Box flexDirection="column">
			<Box>
				{columns.map((col) => (
					<Box
						key={col.key}
						width={col.width ?? 20}
						justifyContent={col.align === 'right' ? 'flex-end' : 'flex-start'}
					>
						<Text dimColor>{col.title}</Text>
					</Box>
				))}
			</Box>
			{data.map((row, i) => (
				<Box key={rowKey ? String(row[rowKey]) : `row-${String(i)}`}>
					{selectedIndex === i && <Text color="cyan">{'\u25B8 '}</Text>}
					{selectedIndex !== undefined && selectedIndex !== i && <Text>{'  '}</Text>}
					{columns.map((col) => {
						const raw = row[col.key];
						const value = col.render ? col.render(raw, row) : String(raw ?? '');
						return (
							<Box
								key={col.key}
								width={col.width ?? 20}
								justifyContent={col.align === 'right' ? 'flex-end' : 'flex-start'}
							>
								<Text>{value}</Text>
							</Box>
						);
					})}
				</Box>
			))}
		</Box>
	);
}
