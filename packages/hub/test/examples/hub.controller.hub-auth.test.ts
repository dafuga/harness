import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HubAuthController } from '../../src/lib/verification-evidence/server/auth/HubAuthController';
import type { HubAuthControllerOptions } from '../../src/lib/verification-evidence/server/auth/HubAuthController.types';

function controller(): HubAuthController {
	const options = {
		clientId: 'example-client',
		sessions: {},
		repository: {},
		challenges: {},
		google: {},
		emailProofs: {},
		routes: {}
	} as unknown as HubAuthControllerOptions;
	return new HubAuthController(options);
}

test('Handles outside and unknown auth routes', async () => {
	const instance = controller();
	const outside = await instance.handle(new Request('https://hub.example/health'));
	const unknown = await instance.handle(new Request('https://hub.example/api/auth/missing'));
	const unknownOutput = unknown ? { status: unknown.status, body: await unknown.json() } : null;

	expect(outside).toBeNull();
	expect(unknownOutput).toMatchObject({ status: 404 });
	recordExampleCases(
		{
			unitId: 'hub.controller.hub-auth',
			symbol: 'handle',
			state: 'handles-outside-and-unknown-auth-routes',
			evidence: 'examples-cases',
			file: 'handles-outside-and-unknown-auth-routes.json'
		},
		[
			{
				name: 'health path is outside the controller namespaces',
				input: { method: 'GET', path: '/health' },
				output: null
			},
			{
				name: 'unknown auth path returns a not found response',
				input: { method: 'GET', path: '/api/auth/missing' },
				output: unknownOutput
			}
		]
	);
});
