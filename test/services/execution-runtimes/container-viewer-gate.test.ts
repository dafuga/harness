import { mkdir, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { join } from 'node:path';
import { PassThrough, Duplex } from 'node:stream';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { ViewerDeviceRepository } from '../../../src/repositories/execution-runtimes/ViewerDeviceRepository';
import { ContainerViewerGateService } from '../../../src/services/execution-runtimes/ContainerViewerGateService';
import { createTempDirectory } from '../../support/temporary';

let directory: string;
let devices: ViewerDeviceRepository;
let remoteDevices: ViewerDeviceRepository;
let gate: ContainerViewerGateService;
let port: number;
let pipes: string[];
const remoteHost = 'browser-viewer.example.test';
const remoteOrigin = `https://${remoteHost}`;
const remoteHeaders = { host: remoteHost, 'cf-access-jwt-assertion': 'fixture-access-assertion' };
let accessExpiresAt: number;

beforeEach(async () => {
	directory = await createTempDirectory('viewer-');
	const assets = join(directory, 'assets');
	await mkdir(assets);
	await writeFile(join(assets, 'vnc.html'), 'CLIENT');
	await writeFile(join(directory, 'secret.txt'), 'SECRET');
	await symlink(join(directory, 'secret.txt'), join(assets, 'link.txt'));
	devices = new ViewerDeviceRepository(join(directory, 'state'));
	remoteDevices = new ViewerDeviceRepository(join(directory, 'remote'), Date.now, 15 * 60_000);
	accessExpiresAt = Date.now() + 15 * 60_000;
	pipes = [];
	gate = new ContainerViewerGateService({
		devices,
		assets,
		hosts: ['127.0.0.1', remoteHost],
		remote: {
			host: remoteHost,
			devices: remoteDevices,
			authorize: async (value) =>
				value === remoteHeaders['cf-access-jwt-assertion'] ? accessExpiresAt : undefined
		},
		pipes: {
			pipe: (name) => {
				pipes.push(name);
				// Echoes viewer bytes, like a screen that answers each message.
				const screen = new PassThrough();
				return Duplex.from({ writable: screen, readable: screen });
			}
		}
	});
	port = await gate.listen(0);
});
afterEach(async () => {
	await gate.close();
	await rm(directory, { recursive: true, force: true });
});

function get(path: string, headers: Record<string, string> = {}, body?: string) {
	return new Promise<{ status: number; body: string; cookie?: string; location?: string }>(
		(resolve, reject) => {
			const options = { host: '127.0.0.1', port, path, headers, method: body ? 'POST' : 'GET' };
			request(options, (response) => {
				let body = '';
				response.on('data', (chunk) => (body += chunk));
				response.on('end', () =>
					resolve({
						status: response.statusCode ?? 0,
						body,
						cookie: response.headers['set-cookie']?.[0],
						location: response.headers.location
					})
				);
			})
				.on('error', reject)
				.end(body);
		}
	);
}

function viewer(cookie: string, origin = `http://127.0.0.1:${port}`, headers = {}) {
	return new WebSocket(`ws://127.0.0.1:${port}/websockify`, {
		headers: { ...headers, cookie, origin }
	});
}

const refused = (socket: WebSocket) =>
	new Promise((resolve) => {
		socket.on('error', () => resolve(true));
		socket.on('open', () => resolve(false));
	});

async function pair(headers?: Record<string, string>) {
	const first = await get('/', headers);
	const cookie = first.cookie!.split(';')[0];
	const code = />(\d{6})</u.exec(first.body)![1];
	return { first, cookie, code };
}

test('an unapproved device sees only its pairing code', async () => {
	const { first, cookie, code } = await pair();
	expect(first.cookie).toContain('HttpOnly; SameSite=Strict');
	expect((await get('/', { cookie })).body).toContain(code);
	expect((await get('/viewer', { cookie })).status).toBe(403);
	expect((await get('/vnc.html', { cookie })).status).toBe(403);
	expect(await refused(viewer(cookie))).toBe(true);
	expect(pipes).toEqual([]);
	const stored = await readFile(join(directory, 'state', 'devices.json'), 'utf8');
	expect(stored).not.toContain(cookie.split('=')[1]);
});

test('approval admits that device to the client and the screen, and revoke removes it', async () => {
	const { cookie, code } = await pair();
	expect(devices.approve('000000' === code ? '000001' : '000000')).toBe(false);
	expect(devices.approve(code)).toBe(true);
	expect(devices.approve(code)).toBe(false);
	const entry = await get('/', { cookie });
	expect(entry).toMatchObject({ status: 302, location: '/viewer' });
	const controls = await get(entry.location!, { cookie });
	expect(controls.status).toBe(200);
	for (const label of ['Back', 'Forward', 'Reload', 'Home', 'URL'])
		expect(controls.body).toContain(label);
	expect((await get('/vnc.html', { cookie })).body).toBe('CLIENT');
	const socket = viewer(cookie);
	await new Promise((resolve) => socket.once('open', resolve));
	expect(devices.attended()).toBe(true);
	const echo = new Promise((resolve) => socket.once('message', (data) => resolve(String(data))));
	socket.send(Buffer.from('RFB 003.008\n'));
	await expect(echo).resolves.toBe('RFB 003.008\n');
	expect(pipes).toEqual(['screen']);
	const closed = new Promise((resolve) => socket.once('close', resolve));
	socket.close();
	await closed;
	await expect.poll(() => devices.attended()).toBe(false);
	devices.revokeAll();
	expect((await get('/vnc.html', { cookie })).status).toBe(403);
});

test('rebinding hosts, foreign origins and paths outside the client are refused', async () => {
	const { cookie, code } = await pair();
	devices.approve(code);
	expect((await get('/', { cookie, host: 'attacker.example' })).status).toBe(403);
	expect(await refused(viewer(cookie, 'http://attacker.example'))).toBe(true);
	const json = { 'content-type': 'application/json' };
	const back = '{"action":"back"}';
	expect(
		(await get('/navigate', { ...json, cookie, origin: 'http://attacker.example' }, back)).status
	).toBe(403);
	const origin = `http://127.0.0.1:${port}`;
	expect((await get('/navigate', { ...json, origin }, back)).status).toBe(403);
	for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.test'])
		expect(
			(await get('/navigate', { ...json, cookie, origin }, JSON.stringify({ action: 'open', url })))
				.status
		).toBe(400);
	for (const path of ['/..%2Fsecret.txt', '/%2e%2e/secret.txt', '/link.txt', '/missing']) {
		const reply = await get(path, { cookie });
		expect(reply.body).not.toContain('SECRET');
		expect(reply.status).not.toBe(200);
	}
	expect(pipes).toEqual([]);
});

test('the remote viewer requires fresh identity and independent device approval', async () => {
	const local = await pair();
	devices.approve(local.code);
	expect(await get('/', { host: remoteHost })).toMatchObject({ status: 403, cookie: undefined });
	expect((await get('/viewer', { ...remoteHeaders, cookie: local.cookie })).status).toBe(403);
	expect((await get('/', { ...remoteHeaders, host: `${remoteHost}:443` })).status).toBe(403);
	const { first, cookie, code } = await pair(remoteHeaders);
	expect(first.cookie).toMatch(/^__Host-harness_viewer=.*Max-Age=900; Secure$/u);
	expect((await get('/viewer', { ...remoteHeaders, cookie })).status).toBe(403);
	expect(await refused(viewer(cookie, remoteOrigin, remoteHeaders))).toBe(true);
	expect(remoteDevices.approve(code)).toBe(true);
	expect((await get('/viewer', { ...remoteHeaders, cookie })).status).toBe(200);
	expect((await get('/viewer', { host: remoteHost, cookie })).status).toBe(403);
	expect(await refused(viewer(cookie, remoteOrigin, { host: remoteHost }))).toBe(true);
	expect(await refused(viewer(cookie, 'https://foreign.example.test', remoteHeaders))).toBe(true);
	accessExpiresAt = Date.now() + 2000;
	const socket = viewer(cookie, remoteOrigin, remoteHeaders);
	await new Promise((resolve) => socket.once('open', resolve));
	expect(devices.attended()).toBe(true);
	await new Promise<void>((resolve) => socket.once('close', () => resolve()));
	expect((await get('/viewer', { ...remoteHeaders, cookie })).status).toBe(403);
	expect(pipes).toEqual(['screen']);
}, 10_000);

test('pairing requests expire and stay bounded; a stale viewer marker is ignored', async () => {
	let now = Date.now();
	const store = new ViewerDeviceRepository(join(directory, 'clock'), () => now);
	const first = store.request();
	for (let index = 0; index < 8; index++) store.request();
	expect(store.counts().pending).toBe(5);
	expect(store.approve(first.code)).toBe(false);
	const last = store.request();
	now += 25 * 60 * 60 * 1000;
	expect(store.approve(last.code)).toBe(false);
	store.markAttended(true);
	const old = new Date(Date.now() - 120_000);
	await utimes(join(directory, 'clock', 'attended'), old, old);
	now = Date.now();
	expect(store.attended()).toBe(false);
});
