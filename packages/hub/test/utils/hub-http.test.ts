import { expect, test } from 'vitest';
import { hubHttpFailure } from '../../src/controllers/hub-api-controller/hubHttp';
import { hubBody } from '../../src/utils/hub-http/hubHttp';
test('unknown provider detail and status never enter public errors', async () => {
	for (const error of [
		{ code: 'synthetic-private-provider-detail', status: 418 },
		null,
		undefined,
		new Error('secret')
	]) {
		const response = hubHttpFailure(error);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'unavailable' });
	}
	expect(hubHttpFailure({ code: 'forbidden', status: 200 }).status).toBe(403);
});
test('non-JSON and oversized requests fail before facade access', async () => {
	await expect(
		hubBody(new Request('https://fixture.example', { method: 'POST', body: 'text' }))
	).rejects.toThrow();
	await expect(
		hubBody(
			new Request('https://fixture.example', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'x'.repeat(20001)
			})
		)
	).rejects.toThrow();
});

test('chunked bodies stop consuming once the byte limit is exceeded', async () => {
	let pulls = 0,
		cancelled = false;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			pulls++;
			controller.enqueue(new Uint8Array(8192));
		},
		cancel() {
			cancelled = true;
		}
	});
	const request = new Request('https://fixture.example', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: stream,
		duplex: 'half'
	} as RequestInit);
	await expect(hubBody(request)).rejects.toThrow();
	expect(cancelled).toBe(true);
	expect(pulls).toBeLessThan(6);
});
