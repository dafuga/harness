import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/replay-video/+server';
import type { Failure } from './reports.endpoint.api-replay-video.test.types';

const UNIT_ID = 'reports.endpoint.api-replay-video';
const VALID_ID = '0f8a2c3e-1b4d-4e5f-8a9b-0c1d2e3f4a5b';
const BAD_REQUEST = { status: 400, message: 'A valid report ID is required' };

function describeFailure(caught: unknown): Failure {
	const record = (caught ?? {}) as { status?: unknown; body?: { message?: unknown } };
	return {
		status: typeof record.status === 'number' ? record.status : null,
		message: typeof record.body?.message === 'string' ? record.body.message : null
	};
}

async function failureOf(run: string | null): Promise<Failure> {
	const query = run === null ? '' : `?run=${encodeURIComponent(run)}`;
	const url = new URL(`https://replay.example.test/api/replay-video${query}`);
	const request = new Request(url);
	try {
		await GET({ url, request });
	} catch (caught) {
		return describeFailure(caught);
	}
	return { status: null, message: null };
}

test('Rejects a run ID that is not a 36-character hex UUID', async () => {
	const inputs = ['not-a-report-id', VALID_ID.toUpperCase(), VALID_ID.slice(0, 35)];
	const cases = [];
	for (const run of inputs) {
		const failure = await failureOf(run);
		expect(failure).toEqual({ status: BAD_REQUEST.status, message: BAD_REQUEST.message });
		cases.push({ name: `run "${run}" is rejected with 400`, input: { run }, output: failure });
	}
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'GET',
			state: 'rejects-a-run-id-that-is-not-a-36-character-hex-uuid',
			evidence: 'examples-cases',
			file: 'rejects-a-run-id-that-is-not-a-36-character-hex-uuid.json'
		},
		cases
	);
});

test('Rejects a request with no run parameter', async () => {
	const failure = await failureOf(null);
	expect(failure).toEqual({ status: BAD_REQUEST.status, message: BAD_REQUEST.message });
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'GET',
			state: 'rejects-a-request-with-no-run-parameter',
			evidence: 'examples-cases',
			file: 'rejects-a-request-with-no-run-parameter.json'
		},
		[{ name: 'missing run parameter is rejected with 400', input: { run: null }, output: failure }]
	);
});
