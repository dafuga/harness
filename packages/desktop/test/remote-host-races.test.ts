import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { RemoteHostService } from '../src/services/RemoteHostService';
import { deferred } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';
import { heldStore, storedOn } from './remote-host-holds';

test('disabling while the enabled record is being written leaves it stored as off', async () => {
	const f = await hostFixture(),
		{ store, entered, release } = heldStore(f, 'save'),
		host = new RemoteHostService(f.options({ store }));
	const enabling = host.enable();
	await entered.promise;
	const disabling = host.disable();
	release.resolve();
	try {
		await Promise.all([enabling, disabling]);
		expect(host.enabled()).toBe(false);
		expect(await storedOn(f)).toBe(false);
		expect(f.relay.bearers).toEqual([]);
		expect(await f.state(host)).toBe('disabled');
	} finally {
		await host.stop();
	}
}, 20000);

test('quitting while the enabled record is being written lets it land and starts nothing', async () => {
	const f = await hostFixture(),
		{ store, entered, release } = heldStore(f, 'save'),
		host = new RemoteHostService(f.options({ store }));
	const enabling = host.enable(),
		next = new RemoteHostService(f.options());
	await entered.promise;
	const stopping = host.stop();
	release.resolve();
	try {
		await Promise.all([enabling, stopping]);
		expect(f.relay.bearers).toEqual([]);
		expect(await storedOn(f)).toBe(true);
		await next.start();
		await f.online(next);
	} finally {
		await Promise.all([host.stop(), next.stop()]);
	}
}, 20000);

test('quitting waits for a record that is being written', async () => {
	const f = await hostFixture(),
		{ store, entered, release } = heldStore(f, 'save'),
		host = new RemoteHostService(f.options({ store }));
	const enabling = host.enable();
	await entered.promise;
	const stopping = host.stop();
	release.resolve();
	try {
		await stopping;
		expect(await storedOn(f)).toBe(true);
	} finally {
		await enabling;
		await host.stop();
	}
}, 20000);

test('a registration that fails after turning off leaves no error behind', async () => {
	const signedOut = Object.assign(new Error('A verified hosted session is required.'), {
		signedOut: true
	});
	for (const failure of [signedOut, new Error('hub unreachable')]) {
		const f = await hostFixture(),
			entered = deferred(),
			release = deferred();
		const host = new RemoteHostService(
			f.options({
				register: async () => {
					entered.resolve();
					await release.promise;
					throw failure;
				}
			})
		);
		const enabling = host.enable();
		await entered.promise;
		await host.disable();
		release.resolve();
		expect(await enabling).toMatchObject({ enabled: false, state: 'disabled', reason: null });
		expect(await host.status()).toMatchObject({ state: 'disabled', reason: null });
	}
}, 20000);

test('a registration that answers late does not replace the one in use', async () => {
	const f = await hostFixture(),
		entered = deferred(),
		release = deferred();
	let early = true;
	const host = new RemoteHostService(
		f.options({
			register: async (input) => {
				const held = early;
				early = false;
				if (held) entered.resolve();
				if (held) await release.promise;
				return f.relay.register(input);
			}
		})
	);
	const first = host.enable();
	await entered.promise;
	try {
		await host.enable();
		await f.online(host);
		const used = (await host.status()).host;
		release.resolve();
		await first;
		expect(f.relay.bearers).toHaveLength(1);
		expect((await host.status()).host).toEqual(used);
		expect((await f.storeFor().read())?.hostId).toBe(used?.id);
	} finally {
		release.resolve();
		await host.stop();
	}
}, 20000);

test('turning on changes nothing when the record cannot be written', async () => {
	const f = await hostFixture(),
		store = f.storeFor();
	store.save = () => Promise.reject(new Error('no space left at /private/path'));
	const host = new RemoteHostService(f.options({ store })),
		status = await host.enable();
	expect(status).toMatchObject({ enabled: false, state: 'disabled', host: null });
	expect(status.reason).not.toContain('/private/path');
	expect(host.enabled()).toBe(false);
	expect(f.relay.bearers).toEqual([]);
	expect(await storedOn(f)).toBe(false);
}, 20000);
