import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface HelpBarProps {
	countdown: number;
}

export function HelpBar({ countdown }: HelpBarProps): ReactNode {
	return (
		<Box marginTop={1}>
			<Text dimColor>
				1-4: tabs {'\u00B7'} {'\u2191\u2193'}: navigate {'\u00B7'} Enter: drill down {'\u00B7'} Esc:
				back {'\u00B7'} p: project {'\u00B7'} r: refresh ({countdown}s) {'\u00B7'} q: quit
			</Text>
		</Box>
	);
}
