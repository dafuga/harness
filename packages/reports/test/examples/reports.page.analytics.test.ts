import type { RequestEvent } from '@sveltejs/kit';
import { test } from 'vitest';
import { load } from '../../src/routes/analytics/+page.server';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Redirects analytics requests to the explorer', () => {
	const requestUrl = new URL('http://localhost/analytics');
	const event = {
		url: requestUrl,
		request: new Request(requestUrl)
	} as RequestEvent;
	const requestLoad: (event: RequestEvent) => never = load;
	let result: { status: number; location: string } | { returned: true };

	try {
		requestLoad(event);
		result = { returned: true };
	} catch (error) {
		const redirect = error as { status: number; location: string };
		result = { status: redirect.status, location: redirect.location };
	}

	recordExampleCases(
		{
			unitId: 'reports.page.analytics',
			symbol: 'load',
			state: 'redirects-analytics-requests-to-the-explorer',
			evidence: 'examples-cases',
			file: 'redirects-analytics-requests-to-the-explorer.json'
		},
		[
			{
				name: 'GET /analytics redirects to the explorer',
				input: { method: event.request.method, url: event.url.pathname },
				output: result
			}
		]
	);

	expect(result).toEqual({ status: 308, location: '/harness' });
});
