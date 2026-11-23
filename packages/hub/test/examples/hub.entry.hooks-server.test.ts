import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { handle } from '../../src/lib/development-tooling/server-hooks/hooks.server';

test('Adds security headers to the resolved response', async () => {
	const event = {} as Parameters<typeof handle>[0]['event'];
	const response = new Response('workspace', {
		headers: {
			'X-Frame-Options': 'SAMEORIGIN',
			'Content-Security-Policy': 'default-src self',
			'Cache-Control': 'public'
		}
	});
	let resolvedEvent: typeof event | undefined;
	const result = await handle({
		event,
		resolve: async (receivedEvent) => {
			resolvedEvent = receivedEvent;
			return response;
		}
	});
	const output = {
		sameResponse: result === response,
		headers: Object.fromEntries(result.headers.entries())
	};
	expect(resolvedEvent).toBe(event);
	expect(result).toBe(response);
	expect(output.headers).toMatchObject({
		'x-frame-options': 'DENY',
		'content-security-policy': "frame-ancestors 'none'",
		'referrer-policy': 'no-referrer',
		'x-content-type-options': 'nosniff',
		'cache-control': 'private, no-store'
	});
	recordExampleCases(
		{
			unitId: 'hub.entry.hooks-server',
			symbol: 'handle',
			state: 'adds-security-headers-to-the-resolved-response',
			evidence: 'examples-cases',
			file: 'adds-security-headers-to-the-resolved-response.json'
		},
		[{ name: 'updates response security headers in place', input: { body: 'workspace' }, output }]
	);
});

test('Propagates a resolve rejection', async () => {
	const event = {} as Parameters<typeof handle>[0]['event'];
	const rejection = new Error('resolve failed');
	let actual: unknown;
	try {
		await handle({ event, resolve: async () => Promise.reject(rejection) });
	} catch (error) {
		actual = error;
	}
	expect(actual).toBe(rejection);
	recordExampleCases(
		{
			unitId: 'hub.entry.hooks-server',
			symbol: 'handle',
			state: 'propagates-a-resolve-rejection',
			evidence: 'examples-cases',
			file: 'propagates-a-resolve-rejection.json'
		},
		[
			{
				name: 'preserves the resolve rejection',
				input: { message: rejection.message },
				error: { name: rejection.name, message: rejection.message }
			}
		]
	);
});
