import type { Keys } from './sync-v1-zero-plaintext.test.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { expectNoPlaintext } from '../../../remote/test/support/plaintextCanary';
import {
	fromBase64Url,
	toBase64Url
} from '../../../remote/src/utils/networking-security/remoteBytes';
import {
	sealedFrame,
	sealedStreamKey
} from '../../../remote/src/utils/networking-security/sealedFrame';
import {
	openSealedRecord,
	sealedRecord
} from '../../../remote/src/utils/networking-security/sealedRecord';
import {
	newScopeKeys,
	sealedObjectId,
	sealedScopeKeys
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { sealedDevice } from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedEnrollCommit } from '../../../remote/src/utils/networking-security/sealedSas';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';
import { storedByObject, storedObjects, storedRows } from '../support/syncCapture';

/**
 * Cloudflare's whole view of a busy account: every D1 row, R2 object and Durable Object row,
 * and everything sent over HTTP and the live socket, holds no canary in any encoding.
 */
let f: SyncFixture;
beforeAll(async () => {
	f = await startSync();
}, 120_000);
afterAll(async () => {
	await f?.stop();
});

const canary = {
	title: 'Ship sealed sync before Friday canary',
	note: 'Daniel prefers the harbor build canary',
	device: "Daniel's iPhone canary",
	output: 'bun test sealed: 29 passed canary',
	project: 'grok private roadmap canary',
	big: 'transcript segment canary '
};
const A = 'session-a';
const device = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
const headers = { 'X-Harness-Device': device };

async function captured(): Promise<(string | Uint8Array)[]> {
	return [
		...f.sent,
		...(await storedRows(f)),
		...(await storedObjects(f)),
		...(await storedByObject(f, 'google:fixture-a'))
	];
}

async function store(method: string, path: string, body: unknown): Promise<void> {
	expect((await f.call(A, method, path, { body, headers })).status).toBe(201);
}

/** An op, a small object and a large object, all sealed, as a busy client would write them. */
async function writeRecords(keys: Keys, scope: string): Promise<string> {
	const op = await sealedRecord(
		keys,
		{ objectId: crypto.getRandomValues(new Uint8Array(32)), revision: 0n },
		{ kind: 'item', title: canary.title, note: canary.note }
	);
	await store('POST', `ops/${scope}`, [toBase64Url(op)]);
	const named = await sealedObjectId(keys, 'device', canary.device);
	const device = { kind: 'device', name: canary.device, project: canary.project };
	const snapshot = await sealedRecord(keys, { objectId: named, revision: 1n }, device);
	await store('PUT', `objects/${scope}/${toBase64Url(named)}`, toBase64Url(snapshot));
	const segmentId = await sealedObjectId(keys, 'transcript', 's1');
	const text = canary.big.repeat(4000);
	const segment = await sealedRecord(keys, { objectId: segmentId, revision: 1n }, { text });
	await store('PUT', `objects/${scope}/${toBase64Url(segmentId)}`, toBase64Url(segment));
	return toBase64Url(segmentId);
}

async function streamFrame(keys: Keys): Promise<Uint8Array> {
	const streamId = crypto.getRandomValues(new Uint8Array(16));
	const data = new TextEncoder().encode(canary.output);
	return sealedFrame(keys, await sealedStreamKey(keys, streamId), { streamId, counter: 0n, data });
}

async function subscribed(scope: string, device: string) {
	const socket = await f.socket(A, device);
	socket.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
	await socket.until(1);
	return socket;
}

test('the server never holds a canary, and the owner of the keys can still read everything back', async () => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const scope = toBase64Url(keys.scopeId);
	const watcher = await subscribed(scope, device);
	const publisher = await subscribed(
		scope,
		toBase64Url(crypto.getRandomValues(new Uint8Array(16)))
	);
	const segment = await writeRecords(keys, scope);
	publisher.send(await streamFrame(keys));
	await watcher.until(3);
	await store('POST', 'enroll', JSON.stringify(await enrollmentRequest()));

	// The positive control: the keys open exactly what the server returned.
	const read = (await (await f.call(A, 'GET', `ops/${scope}`, { headers })).json()) as {
		ops: { envelope: string }[];
	};
	const opened = await openSealedRecord(keys, fromBase64Url(read.ops[0].envelope));
	expect(opened.value).toMatchObject({ title: canary.title });
	const big = await (await f.call(A, 'GET', `objects/${scope}/${segment}`, { headers })).text();
	expect((await openSealedRecord(keys, fromBase64Url(big))).value).toMatchObject({
		text: canary.big.repeat(4000)
	});
	expect((await f.bucket.list()).objects.length).toBe(1);

	const everything = await captured();
	expect(everything.length).toBeGreaterThan(30);
	expectNoPlaintext(
		everything,
		Object.values(canary).map((text) => text.trim())
	);
	watcher.close();
	publisher.close();
}, 120_000);

test('an enrollment request cannot store a plaintext device name', async () => {
	const fields = await enrollmentRequest();
	const leaked = JSON.stringify({ ...fields, name: canary.device });
	const before = await storedByObject(f, 'google:fixture-a');
	const response = await f.call(A, 'POST', 'enroll', { body: leaked, headers });
	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ error: 'invalid-input' });
	const withPlatform = { ...fields, platform: 'iphone', name: canary.device };
	expect((await f.call(A, 'POST', 'enroll', { body: withPlatform, headers })).status).toBe(400);
	const stored = await storedByObject(f, 'google:fixture-a');
	expect(stored).toEqual(before);
	expectNoPlaintext(stored, [canary.device]);

	const duplicate = `{"commit":${JSON.stringify(canary.device)},${JSON.stringify(fields).slice(1)}`;
	const opened = await f.call(A, 'POST', 'enroll', { body: duplicate, headers });
	expect(opened.status).toBe(201);
	expectNoPlaintext(await storedByObject(f, 'google:fixture-a'), [canary.device]);
	expect(() => expectNoPlaintext([...f.sent], [canary.device])).toThrow(/server saw/);
}, 60_000);

async function enrollmentRequest() {
	const keys = await sealedDevice();
	return {
		kemPublic: toBase64Url(keys.kemPublic),
		signingPublic: toBase64Url(keys.signingPublic),
		commit: await sealedEnrollCommit(keys, new Uint8Array(32))
	};
}
