import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { deferred } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';
import { storedOn, turnedOn } from './remote-host-holds';
import type { HostFixture } from './remote-host-holds';

/** A computer that was on before, launched again and online; its next registration is held. */
async function relaunched(f: HostFixture) {
	await turnedOn(f);
	const entered = deferred(),
		release = deferred();
	const host = new RemoteHostService(
		f.options({
			register: async (input) => {
				entered.resolve();
				await release.promise;
				return f.relay.register(input);
			}
		})
	);
	await host.start();
	await f.online(host);
	return { host, entered, release, sockets: f.relay.bearers.length };
}

test('turning off while a host that was on registers again leaves it off', async () => {
	const f = await hostFixture(),
		{ host, entered, release, sockets } = await relaunched(f);
	const enabling = host.enable();
	await entered.promise;
	try {
		await host.disable();
		release.resolve();
		await enabling;
		expect(host.enabled()).toBe(false);
		expect(await host.status()).toMatchObject({ enabled: false, state: 'disabled', reason: null });
		expect(await storedOn(f)).toBe(false);
		expect(f.relay.bearers).toHaveLength(sockets);
	} finally {
		release.resolve();
		await host.stop();
	}
}, 30000);

test('quitting while a host that was on registers again starts nothing and stores nothing', async () => {
	const f = await hostFixture(),
		{ host, entered, release, sockets } = await relaunched(f),
		before = await f.storeFor().read();
	const enabling = host.enable();
	await entered.promise;
	try {
		await host.stop();
		release.resolve();
		await enabling;
		expect(f.relay.bearers).toHaveLength(sockets);
		expect(before).toMatchObject({ enabled: true, generation: 1 });
		expect(await f.storeFor().read()).toEqual(before);
	} finally {
		release.resolve();
		await host.stop();
	}
}, 30000);
