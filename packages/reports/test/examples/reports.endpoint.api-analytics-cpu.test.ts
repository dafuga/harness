import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/analytics-cpu/+server';

test('Rejects requests from non-loopback hosts', async () => {
	const url = new URL('http://example.test/api/analytics-cpu');
	const response = await GET({ url });
	const body = await response.json();

	expect(response.status).toBe(403);
	expect(body).toEqual({ status: 'unavailable' });
	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-analytics-cpu',
			symbol: 'GET',
			state: 'rejects-requests-from-non-loopback-hosts',
			evidence: 'examples-cases',
			file: 'rejects-requests-from-non-loopback-hosts.json'
		},
		[{ name: 'external host receives unavailable response', input: { url: url.href }, output: { status: response.status, body } }]
	);
});

test('Serves a no-store snapshot to loopback hosts', async () => {
	const url = new URL('http://localhost/api/analytics-cpu');
	const response = await GET({ url });
	const body = await response.json();
	const output = {
		status: response.status,
		cacheControl: response.headers.get('cache-control'),
		body
	};

	expect([200, 503]).toContain(response.status);
	expect(response.headers.get('cache-control')).toBe('no-store');
	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-analytics-cpu',
			symbol: 'GET',
			state: 'serves-a-no-store-snapshot-to-loopback-hosts',
			evidence: 'examples-cases',
			file: 'serves-a-no-store-snapshot-to-loopback-hosts.json'
		},
		[{ name: 'loopback host receives analytics snapshot', input: { url: url.href }, output }]
	);
});
