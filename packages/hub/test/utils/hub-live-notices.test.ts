import { afterAll, beforeAll, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';
import { macToken } from '../support/realtimeToken';
import { fileURLToPath } from 'node:url';
import { expectNoPlaintext } from '../../../remote/test/support/plaintextCanary';
import {
	fromBase64Url,
	toBase64Url
} from '../../../remote/src/utils/networking-security/remoteBytes';
import {
	openSealedRecord,
	sealedRecord
} from '../../../remote/src/utils/networking-security/sealedRecord';
import {
	newScopeKeys,
	sealedScopeKeys
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { storedRows } from '../support/syncCapture';

/** The browser and Mac handshakes of the live socket, and the content-free change notices. */
let f: SyncFixture;
beforeAll(async () => {
	f = await startSync({
		entry: fileURLToPath(new URL('../support/realtimeWorker.ts', import.meta.url)),
		migrations: ['0005-hub-home-chat']
	});
}, 120_000);
afterAll(async () => {
	await f?.stop();
});

const device = 'AAAAAAAAAAAAAAAAAAAAAA';
const offered = ['harness.sync.v1', `harness.sync.device.${device}`];
const liveUrl = () => `${f.origin.replace('http', 'ws')}/api/sync/v1/live`;

function open(protocols: string[], headers: Record<string, string> = {}) {
	const socket = new WebSocket(liveUrl(), protocols, { headers });
	const heard: string[] = [];
	socket.on('message', (data) => heard.push(String(data)));
	return new Promise<{ socket: WebSocket; heard: string[] }>((resolve, reject) => {
		socket.on('open', () => resolve({ socket, heard }));
		socket.on('error', reject);
	});
}

const put = (body: unknown) =>
	fetch(`${f.origin}/api/hub-home`, {
		method: 'PUT',
		headers: { Authorization: `Bearer ${macToken}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

const empty = {
	overview: { status: 'unavailable' },
	agents: [],
	plans: [],
	scheduled: [],
	providers: { routines: null, routinesReadAt: null, quota: null }
};

test('a browser subscriber receives and opens a Tracker change through sealed sync', async () => {
	const keys = await sealedScopeKeys(newScopeKeys());
	const scope = toBase64Url(keys.scopeId);
	const browser = await open(offered, { Origin: f.origin });
	const operation = {
		op_id: 'fixture-op',
		item_id: 'fixture-item',
		node: 'fixture-node',
		hlc: '1795818600000-000000-fixture-node',
		fields: { title: 'Tracker title visible only after client decryption' }
	};
	const path = `ops/${scope}`;
	const headers = { 'X-Harness-Device': device };
	try {
		expect(browser.socket.protocol).toBe('harness.sync.v1');
		browser.socket.send(JSON.stringify({ t: 'subscribe', scopes: [scope] }));
		await expect.poll(() => browser.heard).toContain('{"t":"subscribed","ring":0}');
		const started = performance.now();
		const envelope = await sealedRecord(
			keys,
			{ objectId: crypto.getRandomValues(new Uint8Array(32)), revision: 0n },
			operation
		);
		const posted = await f.call(null, 'POST', path, {
			body: [toBase64Url(envelope)],
			headers: { ...headers, Authorization: `Bearer ${macToken}` }
		});
		expect(posted.status).toBe(201);
		await expect
			.poll(() => browser.heard)
			.toContain(JSON.stringify({ t: 'poke', scope, seq: 1, kind: 'ops' }));
		const read = await f.call(null, 'GET', `${path}?after=0`, { headers });
		const { ops, next } = (await read.json()) as {
			ops: { envelope: string }[];
			next: number;
		};
		expect(read.status).toBe(200);
		expect(next).toBe(1);
		expect(ops).toHaveLength(1);
		const opened = await openSealedRecord(keys, fromBase64Url(ops[0].envelope));
		const elapsed = Math.round(performance.now() - started);
		expect(opened.value).toEqual(operation);
		expect(elapsed).toBeLessThan(2000);
		expect(browser.heard).not.toContain('{"t":"changed","topic":"home"}');
		expect((await f.bucket.list()).objects).toEqual([]);
		expectNoPlaintext(
			[...f.sent, ...browser.heard, JSON.stringify(ops), ...(await storedRows(f))],
			[operation.fields.title]
		);
		console.info(`Sealed Tracker fixture encryption to client decryption: ${elapsed} ms`);
	} finally {
		browser.socket.close();
	}
});

test('a browser connects with its device id as a subprotocol and hears a publish', async () => {
	const browser = await open(offered, { Origin: f.origin });
	expect(browser.socket.protocol).toBe('harness.sync.v1');
	const response = await put(empty);
	expect(response.status).toBe(200);
	await expect.poll(() => browser.heard).toContain('{"t":"changed","topic":"home"}');
	browser.socket.send('ping');
	await expect.poll(() => browser.heard).toContain('pong');
	browser.socket.close();
});

test('another site cannot open the socket with the browser cookie', async () => {
	await expect(open(offered, { Origin: 'https://elsewhere.example' })).rejects.toThrow('403');
});

test('a socket that names no device is refused', async () => {
	await expect(open(['harness.sync.v1'], { Origin: f.origin })).rejects.toThrow('400');
});

test('the Home read says pushes are available', async () => {
	const body = await (await fetch(`${f.origin}/api/hub-home`)).json();
	expect(body).toMatchObject({ granted: true, live: true });
});
