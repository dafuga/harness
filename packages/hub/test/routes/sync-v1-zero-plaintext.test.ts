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
	quotaReset: '2041-07-31T23:17:09.000Z',
	quotaCredits: '1278409.37621',
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

async function checkQuotaRoundTrip(keys: Keys, scope: string): Promise<void> {
	const reading = {
		kind: 'quota.subscription',
		device,
		readings: [
			{
				provider: 'codex',
				readAt: '2041-07-30T13:06:07.000Z',
				credits: canary.quotaCredits,
				limits: [{ id: 'weekly', left: 42, resetsAt: canary.quotaReset }]
			}
		]
	};
	const objectId = await sealedObjectId(keys, reading.kind, device);
	const path = `objects/${scope}/${toBase64Url(objectId)}`;
	const envelope = await sealedRecord(keys, { objectId, revision: 1n }, reading);
	await store('PUT', path, toBase64Url(envelope));
	const response = await f.call(A, 'GET', path, { headers });
	expect(response.status).toBe(200);
	const bytes = fromBase64Url(await response.text());
	expect((await openSealedRecord(keys, bytes)).value).toEqual(reading);
	const otherAccount = await sealedScopeKeys(newScopeKeys());
	await expect(openSealedRecord(otherAccount, bytes)).rejects.toThrow(/other scope keys/);
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
	await store('POST', 'enroll', JSON.stringify({ kemPublic: toBase64Url(new Uint8Array(65)) }));

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
	await checkQuotaRoundTrip(keys, scope);
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

test('the check itself notices plaintext: a canary sent in a sign-in step is caught', async () => {
	const leaked = JSON.stringify({ name: canary.device });
	expect((await f.call(A, 'POST', 'enroll', { body: leaked, headers })).status).toBe(201);
	expect(() => expectNoPlaintext([...f.sent], [canary.device])).toThrow(/server saw/);
	const stored = await storedByObject(f, 'google:fixture-a');
	expect(() => expectNoPlaintext(stored, [canary.device])).toThrow(/server saw/);
}, 60_000);
