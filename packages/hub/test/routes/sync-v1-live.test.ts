import { afterAll, beforeAll, expect, test } from 'vitest';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import {
	sealedFrame,
	sealedStreamKey
} from '../../../remote/src/utils/networking-security/sealedFrame';
import { sealedRecord } from '../../../remote/src/utils/networking-security/sealedRecord';
import {
	newScopeKeys,
	sealedScopeKeys
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { sealedDevice } from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedEnrollCommit } from '../../../remote/src/utils/networking-security/sealedSas';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

/** The account object: pokes, sealed stream frames, the replay ring and the sign-in mailbox. */
let f: SyncFixture;
beforeAll(async () => {
	f = await startSync();
}, 120_000);
afterAll(async () => {
	await f?.stop();
});

const A = 'session-a',
	B = 'session-b';
const id = () => toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
const mac = id(),
	phone = id(),
	web = id();
const as = (device: string) => ({ 'X-Harness-Device': device });

async function sealedScope() {
	const raw = newScopeKeys();
	return { keys: await sealedScopeKeys(raw), id: toBase64Url(raw.scopeId) };
}

const streamId = new Uint8Array(16);

async function frame(keys: Awaited<ReturnType<typeof sealedScope>>['keys'], counter: bigint) {
	const data = new TextEncoder().encode(`chunk ${counter}`);
	return sealedFrame(keys, await sealedStreamKey(keys, streamId), { streamId, counter, data });
}

test('a viewer hears about writes to the scopes it asked for, and no others', async () => {
	const { keys, id: scope } = await sealedScope();
	const unrelated = await sealedScope();
	const viewer = await f.socket(A, phone);
	const other = await f.socket(A, web);
	const stranger = await f.socket(B, mac);
	viewer.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
	other.send(JSON.stringify({ t: 'subscribe', scopes: [unrelated.id] }));
	stranger.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
	await Promise.all([viewer.until(1), other.until(1), stranger.until(1)]);
	const record = toBase64Url(
		await sealedRecord(keys, { objectId: new Uint8Array(32), revision: 0n }, { n: 1 })
	);
	expect(
		(await f.call(A, 'POST', `ops/${scope}`, { body: [record], headers: as(mac) })).status
	).toBe(201);
	await viewer.until(2);
	expect(viewer.texts()[1]).toEqual({ t: 'poke', scope, seq: 1, kind: 'ops' });
	await new Promise((resolve) => setTimeout(resolve, 100));
	expect(other.texts().filter((message) => message.t === 'poke')).toEqual([]);
	expect(stranger.texts().filter((message) => message.t === 'poke')).toEqual([]);
	for (const socket of [viewer, other, stranger]) socket.close();
}, 60_000);

test('sealed frames reach the other viewers of their scope, numbered, and replay after a reconnect', async () => {
	const { keys, id: scope } = await sealedScope();
	const publisher = await f.socket(A, mac);
	const viewer = await f.socket(A, phone);
	for (const socket of [publisher, viewer])
		socket.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
	await Promise.all([publisher.until(1), viewer.until(1)]);
	const first = await frame(keys, 0n);
	publisher.send(first);
	await viewer.until(2);
	const received = viewer.messages[1] as Uint8Array;
	expect(new DataView(received.buffer).getBigUint64(0)).toBeGreaterThan(0n);
	expect(received.slice(8)).toEqual(first);
	expect(publisher.messages).toHaveLength(1);
	const ring = new DataView(received.buffer).getBigUint64(0);
	publisher.send(await frame(keys, 1n));
	publisher.send(await frame(keys, 2n));
	await viewer.until(4);
	viewer.close();
	const back = await f.socket(A, phone);
	back.send(JSON.stringify({ t: 'subscribe', scopes: [scope], after: Number(ring) }));
	await back.until(3);
	expect(back.texts()[0]).toMatchObject({ t: 'subscribed' });
	expect(back.messages.slice(1).map((message) => (message as Uint8Array).length)).toEqual([
		8 + first.length,
		8 + first.length
	]);
	const late = await f.socket(A, web);
	late.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
	await late.until(1);
	await new Promise((resolve) => setTimeout(resolve, 100));
	expect(late.messages).toHaveLength(1);
	for (const socket of [publisher, back, late]) socket.close();
}, 60_000);

test('a frame that is not a sealed frame closes the socket', async () => {
	const socket = await f.socket(A, mac);
	socket.send(new Uint8Array([9, 9, 9, 9]));
	for (let waited = 0; socket.closed === null && waited < 2000; waited += 10)
		await new Promise((resolve) => setTimeout(resolve, 10));
	expect(socket.closed).toBe(1008);
	const text = await f.socket(A, mac);
	text.send('{"t":"nonsense"}');
	for (let waited = 0; text.closed === null && waited < 2000; waited += 10)
		await new Promise((resolve) => setTimeout(resolve, 10));
	expect(text.closed).toBe(1008);
}, 60_000);

test('a socket needs a session, and a plain request to live is not an upgrade', async () => {
	await expect(f.socket('nobody', mac)).rejects.toThrow();
	const plain = await f.call(A, 'GET', 'live', { headers: as(mac) });
	expect(plain.status).toBe(426);
}, 60_000);

test('a sign-in request is a mailbox the approver hears about and fills', async () => {
	const approver = await f.socket(A, phone);
	approver.send(JSON.stringify({ t: 'subscribe', scopes: [] }));
	await approver.until(1);
	const keys = await sealedDevice();
	const requestNonce = crypto.getRandomValues(new Uint8Array(32));
	const body = JSON.stringify({
		kemPublic: toBase64Url(keys.kemPublic),
		signingPublic: toBase64Url(keys.signingPublic),
		commit: await sealedEnrollCommit(keys, requestNonce)
	});
	const opened = await f.call(A, 'POST', 'enroll', { body: body, headers: as(web) });
	expect(opened.status).toBe(201);
	const request = (await opened.json()) as {
		id: string;
		steps: { n: number; by: string; body: string }[];
	};
	expect(request.steps).toEqual([{ n: 0, by: web, body }]);
	const reordered = Object.fromEntries(Object.entries(JSON.parse(body)).reverse());
	const retried = await f.call(A, 'POST', 'enroll', { body: reordered, headers: as(web) });
	expect(retried.status).toBe(200);
	expect(await retried.json()).toEqual(request);
	await approver.until(2);
	expect(approver.texts()[1]).toEqual({ t: 'enroll', id: request.id, n: 0 });
	const pending = (await (await f.call(A, 'GET', 'enroll', { headers: as(phone) })).json()) as {
		requests: { id: string }[];
	};
	expect(pending.requests.map((item) => item.id)).toEqual([request.id]);
	const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const claim = JSON.stringify({ approver: phone, nonce });
	const path = `enroll/${request.id}`;
	const refusedClaim = await f.call(A, 'POST', path, {
		body: claim,
		headers: as(mac)
	});
	expect(refusedClaim.status).toBe(400);
	expect(await refusedClaim.json()).toEqual({ error: 'invalid-input' });
	expect(
		(await f.call(A, 'POST', `enroll/${request.id}`, { body: claim, headers: as(phone) })).status
	).toBe(201);
	const retryClaim = await f.call(A, 'POST', path, {
		body: { nonce, approver: phone },
		headers: as(phone)
	});
	expect(retryClaim.status).toBe(200);
	expect(await retryClaim.json()).toEqual({ n: 1, by: phone, body: claim });
	const secondClaim = await f.call(A, 'POST', path, {
		body: { approver: mac, nonce },
		headers: as(mac)
	});
	expect(secondClaim.status).toBe(409);
	const reveal = JSON.stringify({ nonce: toBase64Url(requestNonce) });
	const approval = JSON.stringify({ entryHash: '1'.repeat(64) });
	expect((await f.call(A, 'POST', path, { body: reveal, headers: as(web) })).status).toBe(201);
	expect((await f.call(A, 'POST', path, { body: approval, headers: as(phone) })).status).toBe(201);
	const receiptRetry = await f.call(A, 'POST', path, { body: approval, headers: as(phone) });
	expect(receiptRetry.status).toBe(200);
	expect(await receiptRetry.json()).toEqual({ n: 3, by: phone, body: approval });
	const remaining = await f.call(A, 'GET', 'enroll', { headers: as(phone) });
	expect(await remaining.json()).toEqual({ requests: [] });
	const read = (await (
		await f.call(A, 'GET', `enroll/${request.id}`, { headers: as(web) })
	).json()) as {
		steps: { n: number; by: string; body: string }[];
	};
	expect(read.steps).toEqual([
		{ n: 0, by: web, body },
		{ n: 1, by: phone, body: claim },
		{ n: 2, by: web, body: reveal },
		{ n: 3, by: phone, body: approval }
	]);
	const hidden = await f.call(B, 'GET', `enroll/${request.id}`, { headers: as(web) });
	expect(hidden.status).toBe(404);
	expect((await f.call(A, 'POST', 'enroll', { body: '[1]', headers: as(web) })).status).toBe(400);
	expect(
		(await f.call(A, 'POST', 'enroll/not-an-id', { body: claim, headers: as(phone) })).status
	).toBe(400);
	expect(
		(await f.call(A, 'POST', `enroll/${'0'.repeat(32)}`, { body: claim, headers: as(phone) }))
			.status
	).toBe(409);
	approver.close();
}, 60_000);
