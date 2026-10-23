import type { Fixture } from './remote-host-lifecycle.test.types';
import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { RemoteLifecycleService } from '../src/services/RemoteLifecycleService';
import type { PowerEvent } from '../src/services/RemoteLifecycleService';
import { deferred } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';

const settle = { timeout: 15000 };
async function paired(f: Fixture) {
	await f.host.enable();
	await f.online();
	const { credentials } = await f.pair(),
		phone = f.phone(credentials);
	await phone.connection.connect();
	return { credentials, ...phone };
}
function power(f: Fixture) {
	const listeners = new Map<string, () => void>(),
		cancelled: string[] = [];
	const lifecycle = new RemoteLifecycleService({
		power: { on: (event, listener) => listeners.set(event, listener) },
		host: f.host,
		cancelLocal: () => cancelled.push('local')
	});
	lifecycle.start();
	return { lifecycle, cancelled, fire: (event: PowerEvent) => listeners.get(event)?.() };
}

test('a locked screen changes nothing: the paired phone reads and its run goes on', async () => {
	const gate = deferred(),
		f = await hostFixture(() => gate.promise),
		phone = await paired(f),
		{ fire, lifecycle } = power(f),
		events: RunEvent[] = [];
	phone.client.on('run', (event) => events.push(event as RunEvent));
	try {
		fire('lock-screen');
		expect(lifecycle.locked).toBe(true);
		await phone.client.request('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		expect(await phone.client.request('listProjects')).toHaveLength(1);
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(false);
		expect(await f.state()).toBe('online');
	} finally {
		gate.resolve();
	}
	await expect.poll(() => events.at(-1)?.kind, settle).toBe('finished');
	expect(phone.states).toEqual(['online']);
	fire('unlock-screen');
	expect(await f.state()).toBe('online');
}, 40000);

test('suspension is offline, never success; waking resumes the session without repeating the run', async () => {
	const gate = deferred(),
		f = await hostFixture(() => gate.promise),
		phone = await paired(f),
		{ fire } = power(f),
		events: RunEvent[] = [];
	phone.client.on('run', (event) => events.push(event as RunEvent));
	try {
		await phone.client.request('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		fire('suspend');
		await expect.poll(() => phone.states.at(-1), settle).toBe('offline');
		expect(await f.state()).toBe('offline');
		await expect(phone.client.request('listProjects')).rejects.toMatchObject({ code: 'offline' });
		fire('resume');
		await f.online();
		await expect.poll(() => phone.states.at(-1), settle).toBe('online');
		expect(await phone.client.request('listProjects')).toHaveLength(1);
	} finally {
		gate.resolve();
	}
	await expect.poll(() => events.at(-1)?.kind, settle).toBe('finished');
	expect(f.run).toHaveBeenCalledOnce();
	expect(events.filter((event) => event.kind === 'finished')).toHaveLength(1);
	expect(phone.states).toEqual(['online', 'offline', 'online']);
}, 40000);

test('revoking a phone closes its socket, cancels its run and voids its credential', async () => {
	const gate = deferred(),
		f = await hostFixture(() => gate.promise),
		phone = await paired(f);
	try {
		await phone.client.request('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		const status = await f.host.devices.revokeDevice({ deviceId: phone.credentials.deviceId });
		expect(status.devices).toEqual([]);
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(true);
		await expect.poll(() => phone.states.at(-1), settle).toBe('revoked');
	} finally {
		gate.resolve();
	}
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	const delivered = f.relay.commands.filter((command) => command.type === 'packet').length;
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(f.relay.commands.filter((command) => command.type === 'packet')).toHaveLength(delivered);
	const again = f.phone(phone.credentials);
	await expect(again.connection.connect()).rejects.toThrow();
	expect(f.relay.refused).toBe(1);
	expect((await f.host.status()).devices).toEqual([]);
}, 40000);

test('closing the window keeps an enabled backend; disabling and quitting end it', async () => {
	const f = await hostFixture(),
		phone = await paired(f),
		{ lifecycle, cancelled } = power(f);
	expect(lifecycle.windowsClosed()).toBe('keep');
	expect(cancelled).toEqual(['local']);
	expect(await phone.client.request('listProjects')).toHaveLength(1);
	expect(await f.host.disable()).toMatchObject({ enabled: false, state: 'disabled' });
	await expect.poll(() => phone.states.at(-1), settle).toBe('offline');
	expect(lifecycle.windowsClosed()).toBe('quit');
	await f.host.enable();
	await f.online();
	await expect.poll(() => phone.states.at(-1), settle).toBe('online');
	await lifecycle.quit();
	await expect.poll(() => phone.states.at(-1), settle).toBe('offline');
	expect(await f.state()).toBe('offline');
}, 40000);

test('the approval survives a restart of the app, and a new process is a visible gap', async () => {
	const f = await hostFixture(),
		phone = await paired(f),
		resyncs: unknown[] = [];
	phone.client.on('connection', (event) => resyncs.push(event));
	await f.host.stop();
	await expect.poll(() => phone.states.at(-1), settle).toBe('offline');
	const restarted = new RemoteHostService(f.options());
	await restarted.start();
	await f.online(restarted);
	await expect.poll(() => phone.states.at(-1), settle).toBe('online');
	expect(resyncs).toEqual([{ kind: 'resync' }]);
	expect(await phone.client.request('listProjects')).toHaveLength(1);
	expect((await restarted.status()).devices).toMatchObject([
		{ deviceId: phone.credentials.deviceId, online: true }
	]);
	expect(f.relay.registered).toHaveLength(1);
	await restarted.stop();
}, 40000);
