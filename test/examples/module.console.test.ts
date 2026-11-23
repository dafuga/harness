import type { ConsoleRequest } from './module.console.test.types';
import { test } from 'vitest';
import { denyAll } from '../../src/lib/console';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';

const requests = [
	{ name: 'GET console page', method: 'GET', path: '/console' },
	{ name: 'POST data request', method: 'POST', path: '/api/console/data' }
];

test('Denies every request when the host supplies no policy', () => {
	const results = requests.map((request) => {
		const input = { method: request.method, path: request.path };
		const decision = denyAll(input as unknown as ConsoleRequest);
		return { name: request.name, input, output: decision };
	});

	for (const result of results) {
		expect(result.output).toBe(false);
	}

	recordExampleCases(
		{
			unitId: 'module.console',
			symbol: 'denyAll',
			state: 'denies-every-request-when-the-host-supplies-no-policy',
			evidence: 'examples-cases',
			file: 'denies-every-request-when-the-host-supplies-no-policy.json'
		},
		results
	);
});
