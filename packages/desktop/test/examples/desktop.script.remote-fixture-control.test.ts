import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteFixtureControl } from '../../scripts/remote-fixture-control';

test('serves a fixture action and rejects unmatched requests', async () => {
	const control = await remoteFixtureControl(0, {
		'POST /fixture': (body) => ({ received: body.name ?? null })
	});
	try {
		const acceptedResponse = await fetch(`${control.origin}/fixture`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'sample' })
		});
		const accepted = {
			status: acceptedResponse.status,
			body: await acceptedResponse.json()
		};
		const unmatchedResponse = await fetch(`${control.origin}/missing`);
		const unmatched = {
			status: unmatchedResponse.status,
			body: await unmatchedResponse.json()
		};

		expect(control.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		expect(accepted).toEqual({ status: 200, body: { received: 'sample' } });
		expect(unmatched).toEqual({ status: 404, body: { error: 'not-found' } });
		recordExampleCases(
			{
				unitId: 'desktop.script.remote-fixture-control',
				symbol: 'remoteFixtureControl',
				state: 'serves-a-fixture-action-and-rejects-unmatched-requests',
				evidence: 'examples-cases',
				file: 'serves-a-fixture-action-and-rejects-unmatched-requests.json'
			},
			[
				{
					name: 'POST fixture receives the parsed body',
					input: { port: 0, action: 'POST /fixture', body: { name: 'sample' } },
					output: accepted
				},
				{
					name: 'unmatched route returns not-found',
					input: { port: 0, action: 'GET /missing' },
					output: unmatched
				}
			]
		);
	} finally {
		await control.close();
	}
});
