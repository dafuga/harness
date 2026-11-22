import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/[...path]/+server';

test('Returns unauthenticated response', async () => {
	const request = new Request('https://hub.example.test/api/unknown', { method: 'GET' });
	const event = { request, platform: { env: {} } } as unknown as Parameters<typeof GET>[0];
	const response = await GET(event);
	const body = await response.json();

	expect(response.status).toBe(401);
	expect(body).toEqual({ error: 'session-required' });
	recordExampleCases(
		{
			unitId: 'hub.endpoint.api-path',
			symbol: 'GET',
			state: 'returns-unauthenticated-response',
			evidence: 'examples-cases',
			file: 'returns-unauthenticated-response.json'
		},
		[
			{
				name: 'GET unknown route without a session',
				input: { method: 'GET', url: 'https://hub.example.test/api/unknown' },
				output: { status: response.status, body }
			}
		]
	);
});
