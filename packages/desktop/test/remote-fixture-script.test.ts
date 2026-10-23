import type { Fixture } from './remote-fixture-script.test.types';
import { expect } from '../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeviceConnectionService, DevicePairingService } from '../../remote/src/index';
import type {
	DeviceCredentials,
	DeviceStatus,
	RemoteBinary,
	RemoteConnectionEvent,
	RemotePairingOffer
} from '../../remote/src/index';
import { startRemoteFixture } from '../scripts/remote-fixture-host';
import { RelaySocketAdapter } from '../src/adapters/RelaySocketAdapter';
import type { EntityDetail, ProjectSnapshot } from '../src/models/Desktop.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { remoteBinary } from '../src/utils/remoteBinary';
const settle = { timeout: 20000 },
	sockets = new RelaySocketAdapter(),
	lines: string[] = [],
	states: DeviceStatus[] = [],
	notices: RemoteConnectionEvent[] = [];
let fixture: Fixture,
	publicDirectory: string,
	offer: RemotePairingOffer,
	credentials: DeviceCredentials,
	phone: DeviceConnectionService;
const control = (method: string, path: string, body?: unknown) =>
	fetch(fixture.controlOrigin + path, { method, body: body ? JSON.stringify(body) : undefined });
/** A request with the Host or Origin that another machine or a web page would send. */
function foreign(headers: Record<string, string>) {
	return new Promise<number>((resolve) => {
		const request = httpRequest(fixture.controlOrigin + '/status', { headers }, (response) => {
			response.resume();
			resolve(response.statusCode ?? 0);
		});
		request.end();
	});
}
/** Polls outside a test, where `expect.poll` is not available. */
async function until<T>(read: () => Promise<T>, wanted: T): Promise<void> {
	for (let attempt = 0; attempt < 400; attempt++) {
		if ((await read()) === wanted) return;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error('The fixture did not reach the expected state.');
}
beforeAll(async () => {
	publicDirectory = await mkdtemp(join(tmpdir(), 'harness-remote-fixture-public-'));
	fixture = await startRemoteFixture({ publicDirectory, log: (line) => lines.push(line) });
	offer = (await (await control('POST', '/pairing')).json()) as RemotePairingOffer;
	const pairing = new DevicePairingService(),
		pending = await pairing.request({ ...offer, deviceName: 'Simulator', platform: 'test' });
	await until(() => pairing.poll(pending), 'approved');
	credentials = await pairing.exchange(pending);
	const client = { kind: 'test' as const, name: 'simulator stand-in' },
		open = (url: string, headers: Record<string, string>) => sockets.open(url, headers);
	phone = new DeviceConnectionService({ credentials, client, open });
	phone.onStatus((state) => states.push(state));
	await phone.connect();
	phone.wire.on('connection', (event) => notices.push(event as RemoteConnectionEvent));
}, 120000);
afterAll(async () => {
	await fixture?.stop();
	await rm(publicDirectory, { recursive: true, force: true });
});

test('a phone that typed the code is approved for the synthetic project only, with agents', () => {
	expect(credentials.grant).toEqual({ projects: [fixture.project], agents: true });
	expect(credentials.hostId).toBe(fixture.hostId);
	expect(credentials.origin).toBe(fixture.relayOrigin);
	expect(new URL(fixture.relayOrigin).hostname).toBe('127.0.0.1');
	expect(states).toEqual(['online']);
});

test('the synthetic project is served: a snapshot, its image and a run of the stand-in CLI', async () => {
	const { id: projectId } = fixture.project,
		{ entityId, threadId } = fixture.entity,
		events: RunEvent[] = [];
	phone.wire.on('run', (event) => events.push(event as RunEvent));
	const view = { projectId, branch: null, commit: null },
		snapshot = await phone.wire.request<ProjectSnapshot>('snapshot', view),
		{ commit, branch } = snapshot.revision,
		entity = await phone.wire.request<EntityDetail>('entity', { projectId, entityId, commit }),
		[version] = entity.versions,
		image = { projectId, entityId, commit, version: version.version },
		answer = await phone.wire.request<RemoteBinary>('image', {
			...image,
			sha256: version.images[0].sha256
		});
	expect(snapshot.project).toEqual({ ...fixture.project, root: '' });
	expect((await remoteBinary(answer)).length).toBeGreaterThan(100);
	const run = { mode: 'plan', provider: 'codex', model: 'fixture-model', effort: 'high' },
		ask = { ...run, approval: null, projectId, entityId, threadId, text: 'From the stand-in.' };
	await phone.wire.request('startRun', { ...ask, revision: { branch, commit } });
	await expect.poll(() => events.at(-1)?.kind, settle).toBe('finished');
	expect(events.some((event) => event.kind === 'text')).toBe(true);
}, 60000);

test('the control locks, suspends and resumes the host, for a caller on this machine only', async () => {
	await control('POST', '/lock');
	await expect.poll(() => notices.at(-1), settle).toEqual({ kind: 'host', state: 'locked' });
	await control('POST', '/suspend');
	await expect.poll(() => states.at(-1), settle).toBe('offline');
	expect(await (await control('GET', '/status')).json()).toMatchObject({ state: 'offline' });
	await control('POST', '/resume');
	await expect.poll(() => states.at(-1), settle).toBe('online');
	expect(await foreign({ host: 'evil.example' })).toBe(403);
	expect(await foreign({ origin: 'https://evil.example' })).toBe(403);
	expect((await control('POST', '/shell')).status).toBe(404);
}, 60000);

test('no credential, key or pairing code is printed or written; the offer is given only where it was asked for', async () => {
	/** An offer is open while everything public is read: what would leak it is on the table. */
	const open = (await (await control('POST', '/pairing')).json()) as RemotePairingOffer,
		status = await (await control('GET', '/status')).text(),
		saved = await readFile(join(publicDirectory, 'offer.json'), 'utf8'),
		facts = await readFile(join(publicDirectory, 'fixture.json'), 'utf8'),
		exposed = [status, saved, facts, ...lines].join('\n'),
		codes = [offer, open].flatMap((item) => [item.code, item.code.replace('-', ''), item.scan]);
	for (const secret of [credentials.credential, credentials.keys.d, ...codes])
		expect(exposed).not.toContain(secret);
	expect(open.scan).toContain(`code=${open.code.replace('-', '')};`);
	expect(JSON.parse(status).offer).toMatchObject({ pairingId: open.pairingId });
	expect(JSON.parse(saved)).toMatchObject({ pairingId: open.pairingId });
	for (const item of [offer, open]) {
		const said = `Pairing offer ${item.pairingId} is open until`;
		expect(lines.some((line) => line.startsWith(said))).toBe(true);
	}
	expect(JSON.parse(facts)).toMatchObject({
		relayOrigin: fixture.relayOrigin,
		hostId: offer.hostId,
		controlOrigin: fixture.controlOrigin
	});
}, 60000);

test('revoking through the control ends the phone', async () => {
	await control('POST', '/revoke', { deviceId: credentials.deviceId });
	await expect.poll(() => states.at(-1), settle).toBe('revoked');
	expect(await (await control('GET', '/status')).json()).toMatchObject({ devices: [] });
}, 60000);
