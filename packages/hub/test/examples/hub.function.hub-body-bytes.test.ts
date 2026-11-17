import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubBodyBytes } from '../../src/utils/networking-security/hub-http/hubBodyBytes';

const unitId = 'hub.function.hub-body-bytes';
const url = 'http://localhost/hub-body';
const encoder = new TextEncoder();

function metaFor(state: string) {
	return { unitId, symbol: 'hubBodyBytes', state, evidence: 'examples-cases', file: `${state}.json` };
}

function streamOf(parts: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
	let index = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			const next = parts[index];
			index += 1;
			if (next) controller.enqueue(next);
			else controller.close();
		},
		cancel() {
			onCancel?.();
		}
	});
}

function postWithStream(parts: Uint8Array[], onCancel?: () => void): Request {
	const init = { method: 'POST', body: streamOf(parts, onCancel), duplex: 'half' as const };
	return new Request(url, init);
}

test('Reads chunked request bodies in order', async () => {
	const bytes = await hubBodyBytes(postWithStream([encoder.encode('hub '), encoder.encode('body')]));
	const empty = await hubBodyBytes(postWithStream([]));
	expect(new TextDecoder().decode(bytes)).toBe('hub body');
	expect(empty).toEqual(new Uint8Array(0));
	recordExampleCases(metaFor('reads-chunked-request-bodies-in-order'), [
		{ name: 'two chunks concatenate in order', input: { chunks: ['hub ', 'body'] }, output: { text: 'hub body', byteLength: 8 } },
		{ name: 'empty stream resolves to empty bytes', input: { chunks: [] }, output: { byteLength: 0 } }
	]);
});

test('Rejects a body over 20000 bytes and cancels the reader', async () => {
	let cancelled = false;
	const oversize = postWithStream([new Uint8Array(15000), new Uint8Array(6000)], () => {
		cancelled = true;
	});
	await expect(hubBodyBytes(oversize)).rejects.toThrow();
	expect(cancelled).toBe(true);
	const exact = await hubBodyBytes(postWithStream([new Uint8Array(20000)]));
	expect(exact.byteLength).toBe(20000);
	recordExampleCases(metaFor('rejects-a-body-over-20000-bytes-and-cancels-the-reader'), [
		{ name: 'chunks totalling 21000 bytes are rejected', input: { chunks: [15000, 6000] }, error: 'invalid-input' },
		{ name: 'a body of exactly 20000 bytes is accepted', input: { chunks: [20000] }, output: { byteLength: 20000 } }
	]);
});

test('Rejects a request without a body', async () => {
	const request = new Request(url, { method: 'GET' });
	await expect(hubBodyBytes(request)).rejects.toThrow();
	recordExampleCases(metaFor('rejects-a-request-without-a-body'), [
		{ name: 'GET request has no body stream', input: { method: 'GET', body: null }, error: 'invalid-input' }
	]);
});
