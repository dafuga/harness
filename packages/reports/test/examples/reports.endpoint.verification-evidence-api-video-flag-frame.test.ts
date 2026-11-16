import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/(verification-evidence)/api/video-flag-frame/+server';

const VALID_UNIT = 'reports.frame';
const VALID_ID = '0f8c2a1e-7b3d-4c5a-9e8f-1a2b3c4d5e6f';
const REJECTED = 'Valid frame owner and flag ID required';

async function request(query: { unit: string; id: string }) {
	const url = new URL('https://example.test/api/video-flag-frame');
	url.searchParams.set('unit', query.unit);
	url.searchParams.set('id', query.id);
	const response = await GET({ url, request: new Request(url) });
	return { status: response.status, body: (await response.json()) as unknown };
}

test('Rejects a frame owner with invalid characters', async () => {
	const input = { unit: 'Reports/../etc', id: VALID_ID };
	const result = await request(input);

	expect(result.status).toBe(400);
	expect(result.body).toEqual({ error: REJECTED });
	recordExampleCases(
		{
			unitId: 'reports.endpoint.verification-evidence-api-video-flag-frame',
			symbol: 'GET',
			state: 'rejects-a-frame-owner-with-invalid-characters',
			evidence: 'examples-cases',
			file: 'rejects-a-frame-owner-with-invalid-characters.json'
		},
		[{ name: 'path-like owner is rejected before any flag lookup', input, output: result }]
	);
});

test('Rejects a flag ID that is not a UUID', async () => {
	const input = { unit: VALID_UNIT, id: 'not-a-flag-id' };
	const result = await request(input);

	expect(result.status).toBe(400);
	expect(result.body).toEqual({ error: REJECTED });
	recordExampleCases(
		{
			unitId: 'reports.endpoint.verification-evidence-api-video-flag-frame',
			symbol: 'GET',
			state: 'rejects-a-flag-id-that-is-not-a-uuid',
			evidence: 'examples-cases',
			file: 'rejects-a-flag-id-that-is-not-a-uuid.json'
		},
		[{ name: 'non-UUID flag ID is rejected with HTTP 400', input, output: result }]
	);
});
