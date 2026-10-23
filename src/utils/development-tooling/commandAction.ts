const subcommands: Record<string, string[]> = {
	benchmark: ['validate', 'run', 'results'],
	resources: ['status', 'configure', 'run'],
	task: ['check'],
	loop: ['create', 'add', 'complete', 'status', 'search', 'next', 'evaluate'],
	analytics: ['summary', 'loops', 'jev', 'models', 'benchmarks', 'events', 'import', 'export'],
	activity: ['show', 'register', 'heartbeat', 'finish', 'agents'],
	report: [
		'begin',
		'record',
		'import',
		'finalize',
		'serve',
		'stop',
		'publish',
		'cleanup',
		'sync-storage'
	],
	units: ['index', 'check', 'list', 'show', 'graph', 'retire', 'schema'],
	kernel: ['parity', 'bench', 'default', 'serve', 'sample'],
	scenarios: ['list', 'show', 'check'],
	explain: ['add', 'list', 'check'],
	budget: ['measure', 'status', 'history', 'establish', 'approve', 'bench'],
	verify: ['run', 'check', 'identity', 'stamp'],
	history: ['attach', 'status', 'reasons', 'fetch', 'push', 'sync', 'build', 'import-reports'],
	hooks: ['install', 'uninstall', 'status', 'run'],
	console: ['install', 'objects', 'restore', 'uninstall']
};
export function commandAction(args: string[]): string {
	const command = args[0] ?? 'help';
	if (subcommands[command])
		return `${command} ${subcommands[command].includes(args[1]) ? args[1] : 'help'}`;
	return ['new', 'generate', 'info', 'audit', 'response-check', 'impact'].includes(command)
		? command
		: 'help-or-unknown';
}
