import type { Command } from 'commander';
import { runApi } from '../../workflows/networking-security/runApi';

/** Command wiring only; the app API owns resource access and mutations. */
export class ApiCommand {
	register(program: Command): void {
		const api = apiOptions(
			program
				.command('api')
				.description('Query local or hosted Harness resources and control authorized agents.')
		);
		registerReads(api);
		registerWrites(api);
	}
}

function registerReads(api: Command): void {
	wire(
		api.command('resources').description('List named resources and the generic HTTP escape hatch.'),
		'resources'
	);
	wire(
		api
			.command('connect')
			.description('Connect a private local session or verify hosted authentication.'),
		'connect'
	);
	wire(
		api
			.command('get <resource> [id]')
			.description('Read a resource, entity category or arbitrary /api/ path.'),
		'get'
	);
	wire(
		api.command('request <method> <path>').description('Call any same-server HTTP API endpoint.'),
		'request'
	);
	wire(
		api
			.command('call <method>')
			.description('Call a local bridge or hosted agent operation using JSON input.'),
		'call'
	);
	wire(
		api
			.command('screenshot <entityId>')
			.description('Download a recorded page screenshot, verified against its evidence hash.'),
		'screenshot'
	);
}

function registerWrites(api: Command): void {
	const contracts = api.command('contracts').description('Read or define entity contracts.');
	wire(contracts.command('get <entityId>'), 'contract');
	wire(
		contracts
			.command('define')
			.description('Create a saved plan with an explicit proposed contract.'),
		'define'
	);
	const agents = api
		.command('agents')
		.description('Inspect providers, start runs, read events and cancel runs.');
	wire(agents.command('providers').alias('list'), 'providers');
	wire(
		agents
			.command('start')
			.description('Start with explicit provider/model JSON and a retryable request id.'),
		'start'
	);
	wire(agents.command('events <runId>').alias('show'), 'events');
	wire(agents.command('cancel <runId>'), 'cancel');
}

function wire(command: Command, operation: string): void {
	command.action(async (...parameters: unknown[]) => {
		const invoked = parameters.at(-1) as Command;
		await runApi(operation, parameters.slice(0, -2) as string[], invoked.optsWithGlobals());
	});
}

function apiOptions(api: Command): Command {
	return api
		.option(
			'--url <origin>',
			'Server origin; defaults to HARNESS_API_URL or http://127.0.0.1:5690.'
		)
		.option('--project <id>', 'Hosted project id; defaults to HARNESS_API_PROJECT.')
		.option('--mode <mode>', 'local or hosted; inferred from the server and project.')
		.option('--token-env <name>', 'Hosted bearer-token environment variable.', 'HARNESS_API_TOKEN')
		.option('--branch <name>', 'Selected project branch.')
		.option('--commit <sha>', 'Selected historical commit; mutations require the branch tip.')
		.option('--input <json|@file|->', 'JSON request body, a JSON file, or piped stdin.')
		.option(
			'--query <name=value>',
			'Query field; repeat for multiple values.',
			(field: string, prior: string[]) => [...prior, field],
			[]
		)
		.option('--select <field.path>', 'Select an own field from the JSON response.')
		.option('--output <file|->', 'Write exact bytes to a new file, or stdout with -.')
		.option('--json', 'Print JSON (the default).')
		.option('--timeout <ms>', 'HTTP request deadline in milliseconds.', '30000')
		.option('--request-id <uuid>', 'Stable identity for retrying an agent start.')
		.option('--after <sequence>', 'Run event cursor.', '0')
		.option('--viewport <name>', 'Screenshot viewport, such as desktop, tablet or mobile.')
		.option('--state <name>', 'Recorded screenshot state.')
		.option('--scenario <id>', 'Recorded screenshot scenario.')
		.option('--side <side>', 'Screenshot evidence side: before or after.', 'after');
}
