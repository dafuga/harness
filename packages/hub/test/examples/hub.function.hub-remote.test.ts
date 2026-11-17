import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubRemote } from '../../src/routes/api/[...path]/hubRemote';
import type { HubRemoteRuntime } from '../../src/utils/networking-security/hubRemote';

const hosts = {
	idFromName: (name: string) => ({ name }),
	get: (_id: unknown) => ({ fetch: async () => new Response(null) })
} as unknown as DurableObjectNamespace;

function env(values: Record<string, string>): Parameters<typeof hubRemote>[0] {
	return { ...values, REMOTE_HOSTS: hosts } as Parameters<typeof hubRemote>[0];
}

test('Enables relay runtime for an exact usable origin and binding', () => {
	const productionInput = {
		HARNESS_RELAY_ORIGIN: 'https://relay.example.com/',
		HARNESS_ENVIRONMENT: 'production'
	};
	const localInput = {
		HARNESS_RELAY_ORIGIN: 'http://localhost:8787',
		HARNESS_ENVIRONMENT: 'local'
	};
	const rejectedInput = {
		HARNESS_RELAY_ORIGIN: 'http://relay.example.com',
		HARNESS_ENVIRONMENT: 'production'
	};
	const productionRuntime = hubRemote(env(productionInput)) as HubRemoteRuntime;
	const localRuntime = hubRemote(env(localInput)) as HubRemoteRuntime;
	const rejectedRuntime = hubRemote(env(rejectedInput));
	const missingBinding = hubRemote({
		HARNESS_RELAY_ORIGIN: 'https://relay.example.com',
		HARNESS_ENVIRONMENT: 'production'
	});

	expect(productionRuntime.origin).toBe('https://relay.example.com');
	expect(localRuntime.origin).toBe('http://localhost:8787');
	expect(rejectedRuntime).toBeNull();
	expect(missingBinding).toBeNull();
	recordExampleCases(
		{
			unitId: 'hub.function.hub-remote',
			symbol: 'hubRemote',
			state: 'enables-relay-runtime-for-an-exact-usable-origin-and-binding',
			evidence: 'examples-cases',
			file: 'enables-relay-runtime-for-an-exact-usable-origin-and-binding.json'
		},
		[
			{
				name: 'production HTTPS origin normalizes with the usable binding',
				input: productionInput,
				output: { origin: productionRuntime.origin, relay: 'RelayManageAdapter' }
			},
			{
				name: 'local HTTP origin accepts localhost with the usable binding',
				input: localInput,
				output: { origin: localRuntime.origin, relay: 'RelayManageAdapter' }
			},
			{
				name: 'production rejects HTTP and absent binding disables runtime',
				input: [rejectedInput, { HARNESS_RELAY_ORIGIN: 'https://relay.example.com' }],
				output: [null, null]
			}
		]
	);
});
