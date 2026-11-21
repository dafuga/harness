import { expect, test, vi } from 'vitest';
import { expectJson, hubFixture, operation, signedRequest } from './trackerHubFixture';

test('push accepts a split UTF-8 body and rejects oversized streams before journal access', async () => {
	const { hub, store } = hubFixture();
	const text = JSON.stringify({ ops: [operation] });
	const bytes = Buffer.from(text);
	const split = bytes.indexOf(Buffer.from('☕')) + 1;
	const push = signedRequest({ method: 'POST', path: '/sync/push', text });
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes.subarray(0, split));
			controller.enqueue(bytes.subarray(split));
			controller.close();
		}
	});
	await expectJson(await hub.handle({ ...push, body }), 200, {
		ok: true,
		applied: 1,
		db_id: 'fixture-db',
		last: 1
	});
	const cancel = vi.fn();
	const oversized = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new Uint8Array(8 * 1024 * 1024));
			controller.enqueue(new Uint8Array(1));
		},
		cancel
	});
	await expectJson(await hub.handle({ ...push, body: oversized }), 413, {
		error: 'body too large'
	});
	expect(cancel).toHaveBeenCalledTimes(1);
	expect(store.applyOps).toHaveBeenCalledTimes(1);
});

test('canceling a partially delivered POST releases its reader before peer or journal effects', async () => {
	const { hub, store } = hubFixture();
	const push = signedRequest({ method: 'POST', path: '/sync/push', text: '{}' });
	const client = new AbortController();
	const cancel = vi.fn();
	const body = new ReadableStream<Uint8Array>({ cancel });
	const pending = hub.handle({ ...push, body, signal: client.signal });
	client.abort();
	await expect(pending).rejects.toBe(client.signal.reason);
	expect(cancel).toHaveBeenCalledTimes(1);
	expect(body.locked).toBe(false);
	expect(hub.peers()).toStrictEqual({});
	expect(store.applyOps).not.toHaveBeenCalled();
});

test('malformed signed inputs return fixed client errors and leave the journal intact', async () => {
	const { hub, send, store } = hubFixture();
	const route = { method: 'POST', path: '/sync/push' } as const;
	for (const [text, error] of [
		['{"ops":fixture-private-text', 'invalid JSON body'],
		['null', 'expected a JSON object'],
		[JSON.stringify({ ops: [operation, null] }), 'malformed op'],
		[JSON.stringify({ ops: [{ ...operation, fields: null }] }), 'malformed op fields']
	])
		await expectJson(await send({ ...route, text }), 400, { error });
	const request = signedRequest({ ...route, text: '{}' });
	const invalidUtf8 = new Response(new Uint8Array([0xff])).body;
	await expectJson(await hub.handle({ ...request, body: invalidUtf8 }), 400, {
		error: 'invalid UTF-8 body'
	});
	for (const [query, error] of [
		['since=1.5', 'invalid since'],
		['limit=-1', 'invalid limit'],
		['wait=Infinity', 'invalid wait']
	]) {
		await expectJson(await send({ method: 'GET', path: `/sync/pull?${query}` }), 400, { error });
	}
	expect(store.applyOps).not.toHaveBeenCalled();
	expect(store.opsSince).not.toHaveBeenCalled();
	await expectJson(await send({ ...route, text: '{"ops":null}' }), 200, {
		ok: true,
		applied: 0,
		db_id: 'fixture-db',
		last: 0
	});
});

test('unexpected injected failures return a generic server error', async () => {
	const permitDue = () => {
		throw new Error('synthetic private policy detail');
	};
	const { send } = hubFixture({ permitDue });
	await expectJson(
		await send({
			method: 'POST',
			path: '/sync/permit-due',
			text: '{"id":"fixture-item","token":"fixture-token"}'
		}),
		500,
		{ error: 'internal server error' }
	);
});
