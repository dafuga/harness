import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { deferred } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';

/** Registration uses real host keys; only the relay and encrypted test store are fixtures. */
async function waitingHost() {
	const fixture = await hostFixture();
	const entered = deferred(),
		release = deferred();
	const host = new RemoteHostService(
		fixture.options({
			register: async (input) => {
				entered.resolve();
				await release.promise;
				return fixture.relay.register(input);
			}
		})
	);
	return { fixture, host, entered, release };
}

test('disabling during registration cannot enable or start the host later', async () => {
	const { fixture, host, entered, release } = await waitingHost();
	const enabling = host.enable();
	await entered.promise;
	try {
		await host.disable();
		release.resolve();
		await enabling;
		expect(host.enabled()).toBe(false);
		expect((await fixture.storeFor().read())?.enabled ?? false).toBe(false);
		expect(fixture.relay.bearers).toEqual([]);
	} finally {
		release.resolve();
		await host.stop();
	}
}, 20000);

test('quitting during registration cannot persist or start the host later', async () => {
	const { fixture, host, entered, release } = await waitingHost();
	const enabling = host.enable();
	await entered.promise;
	try {
		await host.stop();
		release.resolve();
		await enabling;
		expect(fixture.relay.bearers).toEqual([]);
		expect((await fixture.storeFor().read())?.enabled ?? false).toBe(false);
	} finally {
		release.resolve();
		await host.stop();
	}
}, 20000);
