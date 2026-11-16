import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedPublicFailure } from '../../src/adapters/networking-security/hosted-http-adapter/hostedPublicFailure';

const summarize = (failure: Awaited<ReturnType<typeof hostedPublicFailure>>) => ({
	category: failure.category,
	status: failure.status,
	message: failure.message
});

async function responseFailure(status: number, body: string) {
	return summarize(await hostedPublicFailure(new Response(body, { status })));
}

test('bounds hosted failure details to public codes and status', async () => {
	const deniedCode = await responseFailure(403, JSON.stringify({ error: 'forbidden' }));
	const deniedUnknown = await responseFailure(
		401,
		JSON.stringify({ error: 'private-diagnostic', detail: 'internal host' })
	);
	const failedCode = await responseFailure(409, JSON.stringify({ error: 'artifact-refused' }));
	const failedMalformed = await responseFailure(503, 'server secret prose');
	expect(deniedCode).toEqual({
		category: 'denied',
		status: 403,
		message: 'The hub refused this read: forbidden.'
	});
	expect(deniedUnknown).toEqual({
		category: 'denied',
		status: 401,
		message: 'The hub refused this read (401).'
	});
	expect(failedCode.message).toBe('The hub refused this read: artifact-refused.');
	expect(failedMalformed.message).toBe('The hub refused this read (503).');
	expect(failedMalformed.message).not.toContain('server secret prose');
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-public-failure',
			symbol: 'hostedPublicFailure',
			state: 'bounds-hosted-failure-details-to-public-codes-and-status',
			evidence: 'examples-cases',
			file: 'bounds-hosted-failure-details-to-public-codes-and-status.json'
		},
		[
			{
				name: 'allowlisted code on a forbidden response',
				input: { status: 403, body: { error: 'forbidden' } },
				output: deniedCode
			},
			{
				name: 'unknown server code and prose on an unauthorized response',
				input: { status: 401, body: { error: 'private-diagnostic', detail: 'internal host' } },
				output: deniedUnknown
			},
			{
				name: 'allowlisted code on another failed response',
				input: { status: 409, body: { error: 'artifact-refused' } },
				output: failedCode
			},
			{
				name: 'unparseable response body does not expose prose',
				input: { status: 503, body: 'server secret prose' },
				output: failedMalformed
			}
		]
	);
});
