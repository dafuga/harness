import { test } from 'vitest';
import { load } from '../../src/routes/harness/reports/+page.server';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Redirects former report hub to explorer', () => {
	let redirect: { status: number; location: string } | undefined;
	try {
		load();
	} catch (error) {
		const thrown = error as { status?: number; location?: string };
		redirect = { status: thrown.status ?? 0, location: thrown.location ?? '' };
	}
	const output = redirect ?? null;
	recordExampleCases(
		{
			unitId: 'reports.page.harness-reports',
			symbol: 'load',
			state: 'redirects-former-report-hub-to-explorer',
			evidence: 'examples-cases',
			file: 'redirects-former-report-hub-to-explorer.json'
		},
		[
			{
				name: 'the former report hub address is opened',
				input: { route: '/harness/reports' },
				output
			}
		]
	);
	expect(output).toEqual({ status: 308, location: '/harness' });
});
