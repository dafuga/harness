import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { mediaResponse } from '../../src/utils/development-tooling/mediaResponse';

async function summarize(response: Response) {
	return {
		status: response.status,
		headers: {
			contentType: response.headers.get('Content-Type'),
			contentLength: response.headers.get('Content-Length'),
			contentRange: response.headers.get('Content-Range'),
			disposition: response.headers.get('Content-Disposition'),
			acceptRanges: response.headers.get('Accept-Ranges'),
			security: response.headers.get('X-Content-Type-Options'),
			cache: response.headers.get('Cache-Control')
		},
		body: await response.text()
	};
}

test('Returns the complete media body with default headers', async () => {
	const bytes = Buffer.from('report-data');
	const response = await summarize(mediaResponse(bytes, 'application/pdf'));
	const input = { bytes: 'report-data', mime: 'application/pdf' };
	expect(response).toEqual({
		status: 200,
		headers: {
			contentType: 'application/pdf',
			contentLength: '11',
			contentRange: null,
			disposition: 'inline',
			acceptRanges: 'bytes',
			security: 'nosniff',
			cache: 'no-store'
		},
		body: 'report-data'
	});
	recordExampleCases(
		{
			unitId: 'reports.function.media-response',
			symbol: 'mediaResponse',
			state: 'returns-the-complete-media-body-with-default-headers',
			evidence: 'examples-cases',
			file: 'returns-the-complete-media-body-with-default-headers.json'
		},
		[{ name: 'PDF without a range uses inline delivery', input, output: response }]
	);
});

test('Returns the selected bytes for a valid range', async () => {
	const response = await summarize(
		mediaResponse(Buffer.from('image-bytes'), 'image/jpeg', 'bytes=6-10', 'attachment; filename="photo.jpg"')
	);
	expect(response.status).toBe(206);
	expect(response.body).toBe('bytes');
	recordExampleCases(
		{
			unitId: 'reports.function.media-response',
			symbol: 'mediaResponse',
			state: 'returns-the-selected-bytes-for-a-valid-range',
			evidence: 'examples-cases',
			file: 'returns-the-selected-bytes-for-a-valid-range.json'
		},
		[{
			name: 'JPEG range requests a byte slice and attachment disposition',
			input: { bytes: 'image-bytes', mime: 'image/jpeg', range: 'bytes=6-10', disposition: 'attachment; filename="photo.jpg"' },
			output: response
		}]
	);
});

test('Rejects malformed and unsatisfiable ranges', async () => {
	const source = Buffer.from('clip');
	const malformed = await summarize(mediaResponse(source, 'video/mp4', 'bytes=1-2,3-3'));
	const unsatisfiable = await summarize(mediaResponse(source, 'video/mp4', 'bytes=8-'));
	expect(malformed.status).toBe(416);
	expect(unsatisfiable.headers.contentRange).toBe('bytes */4');
	recordExampleCases(
		{
			unitId: 'reports.function.media-response',
			symbol: 'mediaResponse',
			state: 'rejects-malformed-and-unsatisfiable-ranges',
			evidence: 'examples-cases',
			file: 'rejects-malformed-and-unsatisfiable-ranges.json'
		},
		[
			{ name: 'multiple ranges are unsupported', input: { bytes: 'clip', mime: 'video/mp4', range: 'bytes=1-2,3-3' }, output: malformed },
			{ name: 'range starts beyond the body', input: { bytes: 'clip', mime: 'video/mp4', range: 'bytes=8-' }, output: unsatisfiable }
		]
	);
});
