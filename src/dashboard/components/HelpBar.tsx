import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface HelpBarProps {
	countdown: number;
	activeTab: string;
}

export function HelpBar({ countdown, activeTab }: HelpBarProps): ReactNode {
	const parts = ['1-5: tabs'];

	if (activeTab === 'breakdown') {
		parts.push('\u2191\u2193: navigate', 'Enter: drill down', 'Esc: back');
	} else if (activeTab === 'projects') {
		parts.push('\u2191\u2193: navigate', 'Enter: add/open');
	}

	parts.push('p: project', `r: refresh (${countdown}s)`, 'q: quit');

	return (
		<Box marginTop={1}>
			<Text dimColor>{parts.join(' \u00B7 ')}</Text>
		</Box>
	);
}
