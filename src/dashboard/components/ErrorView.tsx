import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface ErrorViewProps {
	message: string;
}

export function ErrorView({ message }: ErrorViewProps): ReactNode {
	return (
		<Box flexDirection="column">
			<Text color="red" bold>
				Error
			</Text>
			<Text color="red">{message}</Text>
		</Box>
	);
}
