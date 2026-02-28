import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface LoadingViewProps {
	message?: string;
}

export function LoadingView({ message = 'Loading...' }: LoadingViewProps): ReactNode {
	return (
		<Box gap={1}>
			<Spinner />
			<Text>{message}</Text>
		</Box>
	);
}
