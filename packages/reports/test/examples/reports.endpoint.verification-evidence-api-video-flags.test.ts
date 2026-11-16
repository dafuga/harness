import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET, POST } from '../../src/routes/(verification-evidence)/api/video-flags/+server';
import { readFlagRequest } from '../../src/routes/(verification-evidence)/api/video-flags/flagRequest';

const unitId = 'reports.endpoint.verification-evidence-api-video-flags';
const origin = 'https://reports.example.test';

test('Rejects incomplete current clip query', async () => {
	const url = new URL('https://reports.example.test/api/video-flags?unit=reports.capture&clipId=clip-a');
	const response = await GET({ url });
	expect(response.status).toBe(400);
	const body = await response.json();
	expect(body).toEqual({ error: 'Current clip requires clipId, viewport and sha256' });
	recordExampleCases(
		{
			unitId,
		symbol: 'GET',
			state: 'rejects-incomplete-current-clip-query',
			evidence: 'examples-cases',
			file: 'rejects-incomplete-current-clip-query.json'
		},
		[{ name: 'clipId without viewport or hash is rejected', input: { url: url.href }, output: { status: response.status, body } }]
	);
});

test('Rejects cross-origin feedback request', async () => {
	const url = new URL(origin);
	const request = new Request(`${origin}/api/video-flags`, {
		method: 'POST',
		headers: { origin: 'https://other.example.test', 'content-type': 'application/json' },
		body: JSON.stringify({})
	});
	const response = await POST({ request, url });
	expect(response.status).toBe(403);
	const body = await response.json();
	expect(body).toEqual({ error: 'Same-origin frame feedback required' });
	recordExampleCases(
		{
			unitId,
			symbol: 'POST',
			state: 'rejects-cross-origin-feedback-request',
			evidence: 'examples-cases',
			file: 'rejects-cross-origin-feedback-request.json'
		},
		[{ name: 'foreign Origin is rejected before parsing', input: { origin: 'https://other.example.test', contentType: 'application/json' }, output: { status: response.status, body } }]
	);
});

test('Rejects non-JSON feedback content type', async () => {
	const request = new Request(`${origin}/api/video-flags`, {
		method: 'POST',
		headers: { origin, 'content-type': 'text/plain' },
		body: 'feedback'
	});
	const response = await readFlagRequest(request, origin);
	expect(response).toBeInstanceOf(Response);
	if (!(response instanceof Response)) throw new Error('Expected validation response');
	expect(response.status).toBe(415);
	const body = await response.json();
	expect(body).toEqual({ error: 'JSON frame feedback required' });
	recordExampleCases(
		{
			unitId,
			symbol: 'readFlagRequest',
			state: 'rejects-non-json-feedback-content-type',
			evidence: 'examples-cases',
			file: 'rejects-non-json-feedback-content-type.json'
		},
		[{ name: 'text/plain body is rejected', input: { origin, contentType: 'text/plain', body: 'feedback' }, output: { status: response.status, body } }]
	);
});
