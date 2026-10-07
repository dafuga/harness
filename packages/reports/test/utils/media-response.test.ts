import { expect, test } from 'vitest';
import { mediaResponse } from '../../src/utils/mediaResponse';
const bytes = Buffer.from('0123456789');
test('serves exact ranges, suffixes, open ends and clamped ends for seeking', async () => {
	for (const [range, expected, contentRange] of [
		['bytes=2-4', '234', 'bytes 2-4/10'],
		['bytes=-3', '789', 'bytes 7-9/10'],
		['bytes=6-', '6789', 'bytes 6-9/10'],
		['bytes=8-99', '89', 'bytes 8-9/10']
	]) {
		const response = mediaResponse(bytes, 'audio/wav', range);
		expect(response.status).toBe(206);
		expect(response.headers.get('content-range')).toBe(contentRange);
		expect(response.headers.get('content-type')).toBe('audio/wav');
		expect(response.headers.get('content-length')).toBe(String(expected.length));
		expect(await response.text()).toBe(expected);
	}
});
test('rejects invalid and multi ranges without returning the original bytes', async () => {
	for (const range of [
		'bytes=20-',
		'bytes=4-2',
		'bytes=-0',
		'bytes=-',
		'bytes=0-1,4-5',
		'items=1-2',
		'bytes=-999999999999999999999999',
		'bytes=0-999999999999999999999999'
	]) {
		const response = mediaResponse(bytes, 'audio/wav', range);
		expect(response.status).toBe(416);
		expect(response.headers.get('content-range')).toBe('bytes */10');
		expect(await response.text()).toBe('');
	}
	const full = mediaResponse(bytes, 'audio/wav');
	expect(full.status).toBe(200);
	expect(full.headers.get('accept-ranges')).toBe('bytes');
	expect(await full.text()).toBe('0123456789');
});
