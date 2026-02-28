export function terminalLink(text: string, url: string): string {
	// OSC 8 hyperlink: \e]8;;URL\e\\TEXT\e]8;;\e\\
	// Supported by iTerm2, Windows Terminal, GNOME Terminal, etc.
	if (process.env.TERM_PROGRAM === 'Apple_Terminal') {
		// Apple Terminal.app does not support OSC 8
		return `${text} (${url})`;
	}
	return `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`;
}

export function billingExportUrl(billingAccountId: string): string {
	// Strip "billingAccounts/" prefix if present
	const id = billingAccountId.replace('billingAccounts/', '');
	return `https://console.cloud.google.com/billing/${id}/export`;
}
