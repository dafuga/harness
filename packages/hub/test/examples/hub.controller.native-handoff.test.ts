import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { NativeHandoffController } from '../../src/lib/verification-evidence/server/auth/NativeHandoffController';
import type { NativeHandoffControllerOptions } from '../../src/lib/verification-evidence/server/auth/NativeHandoffController.types';

function jsonRequest(path: string, body: Record<string, string>): Request {
	return new Request(`https://hub.example${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function responseBody(response: Response): Promise<unknown> {
	return response.json();
}

test('Dispatches native handoff route requests', async () => {
	const calls: Array<{ method: string; input: unknown }> = [];
	const handoff = {
		start: async (input: unknown) => {
			calls.push({ method: 'start', input });
			return { handoffId: 'h'.repeat(32) };
		},
		approve: async (session: unknown, input: unknown) => {
			calls.push({ method: 'approve', input: { session, input } });
			return { approved: true, resource: 'projects' };
		},
		poll: async (id: string) => {
			calls.push({ method: 'poll', input: id });
			return { status: 'pending', resource: 'projects' };
		},
		exchange: async (input: unknown) => {
			calls.push({ method: 'exchange', input });
			return { authorization: 'native-token' };
		}
	};
	const session = { actor: { id: 'actor-1' }, idHash: 'session-hash' };
	const options = {
		handoff,
		sessions: { browser: async () => session }
	} as unknown as NativeHandoffControllerOptions;
	const routes = new NativeHandoffController(options).routes();
	const startInput = { challenge: 'a'.repeat(43), nonce: 'n'.repeat(22), resource: 'projects' };
	const handoffId = 'h'.repeat(32);
	const start = await responseBody(
		await routes['POST /api/auth/native/start'](jsonRequest('/api/auth/native/start', startInput))
	);
	const approve = await responseBody(
		await routes['POST /api/auth/native/approve'](
			jsonRequest('/api/auth/native/approve', { handoffId, userCode: 'ABCD2345' })
		)
	);
	const poll = await responseBody(
		await routes['POST /api/auth/native/poll'](jsonRequest('/api/auth/native/poll', { handoffId }))
	);
	const exchangeInput = {
		handoffId,
		verifier: 'v'.repeat(43),
		nonce: 'n'.repeat(22),
		resource: 'projects'
	};
	const exchange = await responseBody(
		await routes['POST /api/auth/native/exchange'](
			jsonRequest('/api/auth/native/exchange', exchangeInput)
		)
	);
	expect(calls.map((call) => call.method)).toEqual(['start', 'approve', 'poll', 'exchange']);
	expect(start).toEqual({ handoffId });
	const state = 'dispatches-native-handoff-route-requests';
	recordExampleCases(
		{
			unitId: 'hub.controller.native-handoff',
			symbol: 'routes',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{ name: 'start validates its JSON body and delegates', input: startInput, output: start },
			{
				name: 'approve resolves browser session before delegating',
				input: { handoffId, userCode: 'ABCD2345' },
				output: approve
			},
			{ name: 'poll delegates the validated handoff id', input: { handoffId }, output: poll },
			{
				name: 'exchange delegates the validated proof bindings',
				input: exchangeInput,
				output: exchange
			}
		]
	);
});

test('Throws AuthFailure when a native route receives an unsupported media type', async () => {
	const options = {
		handoff: {},
		sessions: {}
	} as unknown as NativeHandoffControllerOptions;
	const route = new NativeHandoffController(options).routes()['POST /api/auth/native/start'];
	const request = new Request('https://hub.example/api/auth/native/start', {
		method: 'POST',
		headers: { 'content-type': 'text/plain' },
		body: '{}'
	});
	await expect(route(request)).rejects.toMatchObject({ code: 'invalid-request' });
	const state = 'throws-authfailure-when-a-native-route-receives-an-unsupport';
	recordExampleCases(
		{
			unitId: 'hub.controller.native-handoff',
			symbol: 'routes',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'start rejects a non-JSON request body',
				input: { contentType: 'text/plain', body: '{}' },
				error: { code: 'invalid-request' }
			}
		]
	);
});
