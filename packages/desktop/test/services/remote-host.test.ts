import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
	DevicePairingService,
	credentialHash,
	readPairingOffer,
	remoteIdentity
} from '../../../remote/src/index';
import { RemoteHostService } from '../../src/services/remote-host-service/RemoteHostService';
import { hostFixture } from '../remote-host-fixture';

test('enabling registers a hash under the hosted identity and connects by header', async () => {
	const f = await hostFixture(),
		listened: string[] = [];
	f.host.onStatus((status) => listened.push(status.state));
	expect(await f.state()).toBe('disabled');
	const status = await f.host.enable();
	await f.online();
	const [registration] = f.relay.registered,
		[credential] = f.relay.bearers;
	expect(registration.hostId).toBe(await remoteIdentity(registration.hostKey));
	expect(registration.name).toBe('Fixture Mac');
	expect(JSON.stringify(registration)).not.toContain(credential);
	expect(await credentialHash({ role: 'host', hostId: registration.hostId, credential })).toBe(
		registration.credentialHash
	);
	expect(status).toMatchObject({
		supported: true,
		enabled: true,
		host: { id: registration.hostId, name: 'Fixture Mac' },
		origin: 'https://relay.example',
		projects: [{ id: f.project.id, name: f.project.name }],
		devices: [],
		requests: [],
		pairing: null
	});
	expect(JSON.stringify(await f.host.status())).not.toContain(credential);
	expect((await readFile(f.file)).toString()).not.toContain(credential);
	expect(listened).toContain('online');
	expect(f.host.enabled()).toBe(true);
}, 30000);

test('without OS encryption, or without a hosted session, remote access stays off', async () => {
	const f = await hostFixture(),
		insecure = new RemoteHostService(f.options({ store: f.storeFor(false) }));
	expect(await insecure.enable()).toMatchObject({
		supported: false,
		enabled: false,
		state: 'unavailable'
	});
	const signedOut = Object.assign(new Error('A verified hosted session is required.'), {
		signedOut: true
	});
	const anonymous = new RemoteHostService(f.options({ register: () => Promise.reject(signedOut) }));
	expect(await anonymous.enable()).toMatchObject({ enabled: false, state: 'signed-out' });
	const failing = new RemoteHostService(
		f.options({ register: () => Promise.reject(new Error('hub unreachable at /internal/path')) })
	);
	const failed = await failing.enable();
	expect(failed).toMatchObject({ enabled: false, state: 'disabled' });
	expect(failed.reason).not.toContain('/internal/path');
	expect(f.relay.registered).toEqual([]);
	expect(f.relay.bearers).toEqual([]);
	await expect(insecure.devices.createPairing()).rejects.toThrow();
}, 30000);

test('a phone is paired only after the person approves it with explicit projects', async () => {
	const f = await hostFixture();
	await f.host.enable();
	await f.online();
	const offer = await f.host.devices.createPairing();
	const { origin, hostId, pairingId } = offer;
	expect(
		readPairingOffer(offer.scan, { now: Date.now(), environments: ['production'] })
	).toMatchObject({ offer: { origin, hostId, pairingId, code: offer.code.replace('-', '') } });
	expect((await f.host.status()).pairing).toEqual(offer);
	const pairing = new DevicePairingService({ fetch: f.relay.fetch }),
		input = { ...offer, deviceName: 'Fixture phone', platform: 'test' as const };
	const pending = await pairing.request(input);
	await expect.poll(async () => (await f.host.status()).requests.length).toBe(1);
	const [request] = (await f.host.status()).requests;
	expect(request).toMatchObject({ deviceId: pending.deviceId, deviceName: 'Fixture phone' });
	await expect(pairing.exchange(pending)).rejects.toThrow();
	expect((await f.host.status()).devices).toEqual([]);
}, 30000);

test('approval grants exactly the chosen local projects to exactly that phone', async () => {
	const f = await hostFixture();
	await f.host.enable();
	await f.online();
	const offer = await f.host.devices.createPairing(),
		pairing = new DevicePairingService({ fetch: f.relay.fetch }),
		pending = await pairing.request({ ...offer, deviceName: 'Fixture phone', platform: 'test' });
	await expect.poll(async () => (await f.host.status()).requests.length).toBe(1);
	const { pairingId } = offer,
		unknown = 'local-' + 'e'.repeat(64);
	for (const projectIds of [
		[unknown],
		[f.project.id, unknown],
		[],
		['a6196e55-8746-4bc5-bfeb-5e2c8771e241']
	])
		await expect(
			f.host.devices.approvePairing({
				deviceId: pending.deviceId,
				pairingId,
				projectIds,
				agents: true
			})
		).rejects.toThrow();
	expect((await f.host.status()).devices).toEqual([]);
	const approved = await f.host.devices.approvePairing({
		deviceId: pending.deviceId,
		pairingId,
		projectIds: [f.project.id],
		agents: false
	});
	expect(approved.devices).toMatchObject([
		{
			deviceId: pending.deviceId,
			name: 'Fixture phone',
			platform: 'test',
			projectIds: [f.project.id],
			agents: false,
			online: false
		}
	]);
	expect(approved.requests).toEqual([]);
	const credentials = await pairing.exchange(pending);
	expect(credentials.grant).toEqual({
		projects: [{ id: f.project.id, name: f.project.name }],
		agents: false
	});
	const phone = f.phone(credentials),
		attachment = await phone.connection.connect();
	expect(attachment).toMatchObject({ role: 'device', grant: credentials.grant });
	expect(attachment.methods).not.toContain('startRun');
	await expect.poll(async () => (await f.host.status()).devices[0]?.online).toBe(true);
	expect(await phone.client.request('listProjects')).toHaveLength(1);
	expect(f.relay.forwarded.join('\n')).not.toContain('listProjects');
}, 30000);

test('a wrong code, or a denied request, never becomes a device', async () => {
	const f = await hostFixture();
	await f.host.enable();
	await f.online();
	const offer = await f.host.devices.createPairing(),
		pairing = new DevicePairingService({ fetch: f.relay.fetch }),
		input = { ...offer, deviceName: 'Fixture phone', platform: 'test' as const };
	await pairing.request({ ...input, code: 'WRNG-CDE2' });
	await new Promise((resolve) => setTimeout(resolve, 30));
	expect((await f.host.status()).requests).toEqual([]);
	const pending = await pairing.request(input);
	await expect.poll(async () => (await f.host.status()).requests.length).toBe(1);
	const denied = await f.host.devices.denyPairing({ pairingId: offer.pairingId });
	expect(denied).toMatchObject({ requests: [], devices: [], pairing: null });
	expect(await pairing.poll(pending)).toBe('denied');
	await expect(pairing.exchange(pending)).rejects.toThrow();
}, 30000);
