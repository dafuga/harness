import { afterAll, beforeAll, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';
import { macToken } from '../support/realtimeToken';
import { fileURLToPath } from 'node:url';

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
