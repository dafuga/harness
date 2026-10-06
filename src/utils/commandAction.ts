const subcommands: Record<string, string[]> = {
	loop: ['create', 'add', 'complete', 'status', 'search', 'next', 'evaluate'],
	analytics: ['summary', 'loops', 'jev', 'models', 'events', 'import', 'export'],
	report: ['begin', 'record', 'import', 'finalize', 'serve', 'publish', 'cleanup', 'sync-storage']
};
export function commandAction(args: string[]): string {
	const command = args[0] ?? 'help';
	if (subcommands[command])
		return `${command} ${subcommands[command].includes(args[1]) ? args[1] : 'help'}`;
	return ['new', 'generate', 'info', 'audit', 'response-check'].includes(command)
		? command
		: 'help-or-unknown';
}
