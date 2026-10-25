const common = [
	'command.networking-security-api',
	'service.networking-security-harness-api',
	'adapter.networking-security-harness-http',
	'service.networking-security-harness-api-service-api-session-repository',
	'workflow.networking-security-run-api',
	'workflow.networking-security-run-api-api-output',
	'entry.program',
	'entry.index'
];

export function apiMeasuredUnits(args: string[]): string[] {
	const units = [...common];
	if (args.includes('get') || args.includes('contracts'))
		units.push('workflow.networking-security-run-api-api-resources');
	if (args.includes('contracts') || ['units', 'registry'].includes(args[args.indexOf('get') + 1]))
		units.push('workflow.networking-security-run-api-api-registry');
	if (args.includes('screenshot'))
		units.push('workflow.networking-security-run-api-api-screenshot');
	if (['agents', 'define', 'call'].some((operation) => args.includes(operation)))
		units.push('workflow.networking-security-run-api-api-agent');
	if (args.includes('--input') || args.includes('--query'))
		units.push('workflow.networking-security-run-api-api-input');
	return units;
}

export function apiWorkloadArgs(args: string[]): string[] {
	const operations = [
		'resources',
		'get',
		'request',
		'connect',
		'contracts',
		'screenshot',
		'agents',
		'call'
	];
	const index = args.findIndex((argument) => operations.includes(argument));
	const verb = args[index] ?? 'operation';
	return ['api', verb, ...(['contracts', 'agents'].includes(verb) ? [args[index + 1]] : [])];
}
