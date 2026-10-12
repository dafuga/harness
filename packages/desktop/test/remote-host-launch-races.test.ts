import { test, vi } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { RemoteHostService } from '../src/services/RemoteHostService';
import { deferred } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';
import { heldStore, storedOn, turnedOn } from './remote-host-holds';

/** The first import of a stored private key is held open; every other call goes straight on. */
function heldKeyImport() {
	const entered = deferred(),
		release = deferred(),
		real = crypto.subtle.importKey.bind(crypto.subtle) as (...given: unknown[]) => Promise<unknown>;
	let waited = false;
	const slow = async (...given: unknown[]) => {
		if (!waited && given[0] === 'jwk') {
			waited = true;
			entered.resolve();
			await release.promise;
		}
		return real(...given);
	};
	const spy = vi.spyOn(crypto.subtle, 'importKey').mockImplementation(slow as never);
	return { entered, release, restore: () => spy.mockRestore() };
}

test('disabling while the stored record is still being read at launch keeps it off', async () => {
	const f = await hostFixture(),
		sockets = await turnedOn(f),
		{ store, entered, release } = heldStore(f, 'read'),
		host = new RemoteHostService(f.options({ store }));
	const starting = host.start();
	await entered.promise;
	const disabling = host.disable();
	release.resolve();
	try {
		await Promise.all([starting, disabling]);
		expect(host.enabled()).toBe(false);
		expect(await storedOn(f)).toBe(false);
		expect(f.relay.bearers).toHaveLength(sockets);
		expect(await f.state(host)).toBe('disabled');
	} finally {
		await host.stop();
	}
}, 30000);

test('quitting while the stored record is still being read starts nothing and keeps it on', async () => {
	const f = await hostFixture(),
		sockets = await turnedOn(f),
		{ store, entered, release } = heldStore(f, 'read'),
		host = new RemoteHostService(f.options({ store }));
	const starting = host.start();
	await entered.promise;
	try {
		await host.stop();
		release.resolve();
		await starting;
		expect(f.relay.bearers).toHaveLength(sockets);
		expect(await storedOn(f)).toBe(true);
	} finally {
		release.resolve();
		await host.stop();
	}
}, 30000);

test('quitting while the stored keys are being imported at launch starts nothing', async () => {
	const f = await hostFixture(),
		sockets = await turnedOn(f),
		host = new RemoteHostService(f.options()),
		{ entered, release, restore } = heldKeyImport();
	const starting = host.start();
	try {
		await entered.promise;
		await host.stop();
		release.resolve();
		await starting;
		expect(f.relay.bearers).toHaveLength(sockets);
		expect(await storedOn(f)).toBe(true);
	} finally {
		release.resolve();
		restore();
		await host.stop();
	}
}, 30000);

test('off and on again during launch: a turning-on that fails leaves it off', async () => {
	const f = await hostFixture(),
		sockets = await turnedOn(f),
		{ store, entered, release } = heldStore(f, 'read'),
		register = () => Promise.reject(new Error('hub unreachable')),
		host = new RemoteHostService(f.options({ store, register }));
	const starting = host.start();
	await entered.promise;
	const disabling = host.disable(),
		enabling = host.enable();
	release.resolve();
	try {
		await Promise.all([starting, disabling, enabling]);
		expect(host.enabled()).toBe(false);
		expect(await storedOn(f)).toBe(false);
		expect(f.relay.bearers).toHaveLength(sockets);
		expect(await f.state(host)).toBe('disabled');
	} finally {
		await host.stop();
	}
}, 30000);
