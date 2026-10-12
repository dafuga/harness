import { expect, test } from 'vitest';
import { readJsonBody } from '../../src/utils/readJsonBody';

const limit = 16 * 1024;

function post(body: BodyInit, type: string | null = 'application/json'): Request {
	const headers: Record<string, string> = type === null ? {} : { 'Content-Type': type };
	return new Request('https://relay.test/body', { method: 'POST', headers, body });
}

/** A JSON object of exactly `bytes` bytes. */
function sized(bytes: number): string {
	return JSON.stringify({ sealed: 'A'.repeat(bytes - '{"sealed":""}'.length) });
}

test('readJsonBody reads a JSON object', async () => {
	expect(await readJsonBody(post('{"verifier":"abc","n":1}'))).toEqual({ verifier: 'abc', n: 1 });
	expect(await readJsonBody(post('{}', 'application/json; charset=utf-8'))).toEqual({});
});

test('readJsonBody needs the JSON content type, unless the caller is internal', async () => {
	expect(await readJsonBody(post('{"a":1}', 'text/plain'))).toBeUndefined();
	expect(await readJsonBody(post('{"a":1}', 'application/x-www-form-urlencoded'))).toBeUndefined();
	expect(await readJsonBody(post('{"a":1}', 'application/jsonp'))).toBeUndefined();
	expect(await readJsonBody(post('{"a":1}', 'text/plain'), false)).toEqual({ a: 1 });
});

test('readJsonBody refuses everything that is not a JSON object', async () => {
	for (const body of ['', '[]', '[{"a":1}]', 'null', '"text"', '7', 'true', '{', '{"a":1}}']) {
		expect(await readJsonBody(post(body)), body).toBeUndefined();
	}
	expect(await readJsonBody(post(new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d])))).toBeUndefined();
});

test('readJsonBody accepts 16 KiB and refuses one byte more', async () => {
	expect(sized(limit).length).toBe(limit);
	expect(await readJsonBody(post(sized(limit)))).toBeDefined();
	expect(await readJsonBody(post(sized(limit + 1)))).toBeUndefined();
});

test('readJsonBody stops reading a stream that never ends', async () => {
	let sent = 0;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			sent += 1024;
			controller.enqueue(new Uint8Array(1024).fill(0x20));
		}
	});
	const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream };
	const request = new Request('https://relay.test/body', {
		...init,
		duplex: 'half'
	} as RequestInit);
	expect(await readJsonBody(request)).toBeUndefined();
	expect(sent).toBeLessThanOrEqual(4 * limit);
});
