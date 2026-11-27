import type { Fixture } from './remote-fixture-script.test.types';
import { expect } from '../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeviceConnectionService } from '../../remote/src/index';
import { accountPairing } from './remote-account-pairing';
import type {
	DeviceCredentials,
	DeviceStatus,
	RemoteBinary,
	RemoteConnectionEvent
} from '../../remote/src/index';
import { startRemoteFixture } from '../scripts/remote-fixture-host';
import { RelaySocketAdapter } from '../src/adapters/networking-security/RelaySocketAdapter';
import type {
	EntityDetail,
	ProjectSnapshot
} from '../src/models/development-tooling/Desktop.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { remoteBinary } from '../src/utils/networking-security/remoteBinary';
const settle = { timeout: 20000 },
	sockets = new RelaySocketAdapter(),
	lines: string[] = [],
	states: DeviceStatus[] = [],
	notices: RemoteConnectionEvent[] = [];
let fixture: Fixture,
	publicDirectory: string,
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
	const { pairing, pending } = await accountPairing(
		{
			origin: fixture.relayOrigin,
			hostId: fixture.hostId,
			hostKey: fixture.hostKey,
			submit: async (pairingId, request) => {
				const sent = await control('POST', '/account-request', { pairingId, request });
				if (!sent.ok) throw new Error('The fixture refused the account request.');
			}
		},
		'Simulator'
	);
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

test('a signed-in phone is approved for the synthetic project only, with agents', () => {
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
	expect(
		events.find((event) => event.kind === 'status' && event.phase === 'generating')
	).toMatchObject({
		detail: 'Preparing HTML mockups with claude-sonnet-5-5'
	});
	const design = events.find((event) => event.kind === 'design');
	expect([...new Set(design?.images.map((image) => image.viewport))]).toEqual([
		'width-390',
		'width-834',
		'width-1440',
		'width-1920'
	]);
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

test('no credential or key is printed or written, and the public facts hold no private key', async () => {
	const status = await (await control('GET', '/status')).text(),
		facts = await readFile(join(publicDirectory, 'fixture.json'), 'utf8'),
		exposed = [status, facts, ...lines].join('\n');
	for (const secret of [credentials.credential, credentials.keys.d])
		expect(exposed).not.toContain(secret);
	expect(JSON.parse(facts)).toMatchObject({
		relayOrigin: fixture.relayOrigin,
		hostId: credentials.hostId,
		controlOrigin: fixture.controlOrigin
	});
	expect(JSON.parse(status)).not.toHaveProperty('offer');
}, 60000);

test('revoking through the control ends the phone', async () => {
	await control('POST', '/revoke', { deviceId: credentials.deviceId });
	await expect.poll(() => states.at(-1), settle).toBe('revoked');
	expect(await (await control('GET', '/status')).json()).toMatchObject({ devices: [] });
}, 60000);
