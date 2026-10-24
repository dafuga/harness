import type { HarnessApiOptions } from '../../services/networking-security/HarnessApiService.types';
import { HarnessApiService } from '../../services/networking-security/HarnessApiService';
import { apiInput, apiQuery } from './run-api/apiInput';
import { apiAgent, apiEventCursor } from './run-api/apiAgent';
import { apiOutput } from './run-api/apiOutput';
import { apiResource, apiResources } from './run-api/apiResources';
import { apiScreenshot } from './run-api/apiScreenshot';
import { fail } from '../../core/development-tooling/errors';

export async function runApi(
	operation: string,
	args: string[],
	options: HarnessApiOptions
): Promise<void> {
	const client = new HarnessApiService(options);
	const result = await execute(client, operation, args);
	await apiOutput(result, operation === 'screenshot' ? { ...options, output: undefined } : options);
}

async function execute(
	client: HarnessApiService,
	operation: string,
	args: string[]
): Promise<unknown> {
	const options = client.options;
	const operations: Record<string, () => unknown> = {
		resources: () => ({
			...apiResources,
			server: client.http.origin,
			mode: client.hosted ? 'hosted' : 'local',
			project: client.project ?? null
		}),
		connect: () => client.connect(),
		screenshot: () => apiScreenshot(client, args[0], options),
		get: () => get(client, args),
		request: async () =>
			client.http.request(args[0].toUpperCase(), args[1], {
				query: apiQuery(options.query),
				input: options.input === undefined ? undefined : await apiInput(options.input)
			}),
		contract: () => apiResource(client, 'contracts', args[0]),
		providers: () => client.call('providers', {}),
		cancel: () => client.call('cancelRun', { runId: args[0] }),
		events: () => client.call('events', { runId: args[0], after: apiEventCursor(options.after) }),
		define: () => apiAgent(client, 'define'),
		start: () => apiAgent(client, 'start'),
		call: () => apiAgent(client, 'call', args[0])
	};
	if (!Object.hasOwn(operations, operation)) fail('Unknown API operation.');
	return operations[operation]();
}

function get(client: HarnessApiService, args: string[]): Promise<unknown> {
	if (args[0].startsWith('/') || args[0].includes('://'))
		return client.http.request('GET', args[0], { query: apiQuery(client.options.query) });
	return apiResource(client, args[0], args[1]);
}
