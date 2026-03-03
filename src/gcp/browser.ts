import { execFile } from 'node:child_process';

export function openInBrowser(url: string): void {
	const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
	execFile(cmd, [url], () => {
		// Silently ignore errors — browser may not be available
	});
}
