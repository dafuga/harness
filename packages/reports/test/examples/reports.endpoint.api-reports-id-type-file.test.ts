import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/reports/[id]/[type]/[file]/+server';
import type { Params, Outcome } from './reports.endpoint.api-reports-id-type-file.test.types';

const FILE = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.png';
const FALLBACK = 'Registered asset not found';
const INVALID_IDS = ['not a uuid!', '../../etc/passwd', 'x'.repeat(101)];

async function call(params: Params, range: string | null): Promise<Outcome> {
	const request = new Request('http://localhost/', { headers: range === null ? {} : { range } });
	try {
		const response = await GET({ params, request });
		return { status: response.status, message: undefined };
	} catch (reason) {
		const httpError = reason as { status?: number; body?: { message?: string } };
		return { status: httpError.status, message: httpError.body?.message };
	}
}

test('Replies with the fallback 404 for an invalid report id', async () => {
	const inputs = INVALID_IDS.map((id) => ({ id, type: 'assets', file: FILE }));
	const outcomes = await Promise.all(inputs.map((params) => call(params, null)));

	expect(outcomes).toEqual(INVALID_IDS.map(() => ({ status: 404, message: FALLBACK })));
	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-reports-id-type-file',
			symbol: 'GET',
			state: 'replies-with-the-fallback-404-for-an-invalid-report-id',
			evidence: 'examples-cases',
			file: 'replies-with-the-fallback-404-for-an-invalid-report-id.json'
		},
		inputs.map((input, index) => ({
			name: `invalid report id case ${index + 1} returns the fallback 404`,
			input: { params: input, range: null },
			output: outcomes[index]
		}))
	);
});

test('Replies with the fallback 404 when a Range header is sent', async () => {
	const params: Params = { id: 'not a uuid!', type: 'assets', file: FILE };
	const outcome = await call(params, 'bytes=0-99');

	expect(outcome).toEqual({ status: 404, message: FALLBACK });
	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-reports-id-type-file',
			symbol: 'GET',
			state: 'replies-with-the-fallback-404-when-a-range-header-is-sent',
			evidence: 'examples-cases',
			file: 'replies-with-the-fallback-404-when-a-range-header-is-sent.json'
		},
		[
			{
				name: 'invalid report id with a bytes range still returns the fallback 404',
				input: { params, range: 'bytes=0-99' },
				output: outcome
			}
		]
	);
});
