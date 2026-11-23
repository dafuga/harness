import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HubRemoteController } from '../../src/routes/api/[...path]/hub-api-controller/HubRemoteController';

const actor = {
	id: '7f1c2d18-0c18-4c5e-9e1b-2a7e6ac9d401',
	email: 'alex.morgan@example.com',
	name: 'Alex Morgan',
	emailVerified: true as const
};

async function responseSummary(response: Response) {
	return { status: response.status, body: await response.json() };
}

test('Returns not found for an unmatched remote path', async () => {
	const response = await new HubRemoteController().handle(
		new Request('https://hub.example/api/remote/hosts/host-1/extra'),
		actor
	);
	const output = await responseSummary(response);

	expect(output).toEqual({ status: 404, body: { error: 'not-found' } });
	recordExampleCases(
		{
			unitId: 'hub.controller.hub-remote',
			symbol: 'handle',
			state: 'returns-not-found-for-an-unmatched-remote-path',
			evidence: 'examples-cases',
			file: 'returns-not-found-for-an-unmatched-remote-path.json'
		},
		[
			{
				name: 'extra path segment is rejected',
				input: { method: 'GET', path: '/api/remote/hosts/host-1/extra' },
				output
			}
		]
	);
});

test('Denies unsupported methods on a recognized remote path', async () => {
	const response = await new HubRemoteController().handle(
		new Request('https://hub.example/api/remote/hosts', { method: 'GET' }),
		actor
	);
	const output = await responseSummary(response);

	expect(output).toEqual({ status: 405, body: { error: 'method-denied' } });
	recordExampleCases(
		{
			unitId: 'hub.controller.hub-remote',
			symbol: 'handle',
			state: 'denies-unsupported-methods-on-a-recognized-remote-path',
			evidence: 'examples-cases',
			file: 'denies-unsupported-methods-on-a-recognized-remote-path.json'
		},
		[
			{
				name: 'GET collection has no configured action',
				input: { method: 'GET', path: '/api/remote/hosts' },
				output
			}
		]
	);
});

test('Reports disabled remote runtime for a matched action', async () => {
	let error: unknown;
	try {
		await new HubRemoteController(null).handle(
			new Request('https://hub.example/api/remote/hosts/host-1'),
			actor
		);
	} catch (caught) {
		error = caught;
	}
	const output =
		error instanceof Error
			? {
					name: error.name,
					message: error.message,
					code: (error as Error & { code?: string }).code
				}
			: { value: error };

	expect(output).toMatchObject({ code: 'remote-disabled' });
	recordExampleCases(
		{
			unitId: 'hub.controller.hub-remote',
			symbol: 'handle',
			state: 'reports-disabled-remote-runtime-for-a-matched-action',
			evidence: 'examples-cases',
			file: 'reports-disabled-remote-runtime-for-a-matched-action.json'
		},
		[
			{
				name: 'matched host summary requires a runtime',
				input: { method: 'GET', path: '/api/remote/hosts/host-1' },
				error: output
			}
		]
	);
});
