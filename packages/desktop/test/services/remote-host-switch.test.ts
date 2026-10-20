import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RemoteHostStoreAdapter } from '../../src/adapters/RemoteHostStoreAdapter';
import { RemoteHostRecordService } from '../../src/services/RemoteHostRecordService';
import { RemoteHostSwitchService } from '../../src/services/remote-host-switch-service/RemoteHostSwitchService';
import { remoteHostIdentity } from '../../src/services/remote-host-switch-service/remoteHostIdentity';
import type { RegisterRemoteHost } from '../../src/utils/remoteHostIdentity';
import { deferred } from '../remote-fixture';
import { fakeEncryption } from '../remote-host-fixture';

const roots: string[] = [];
const origin = 'https://relay.example';
const plain = 'Remote access could not be registered. Try again.';
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
/** The hub's answer, held open until released where `held` is set. */
function hub(held = false) {
	const entered = deferred(),
		release = deferred(),
		asked: string[] = [];
	const register: RegisterRemoteHost = async ({ hostId }) => {
		const generation = asked.push(hostId);
		entered.resolve();
		if (held) await release.promise;
		return { hostId, origin, generation, registeredAt: '2026-10-12T00:00:00.000Z' };
	};
	return { register, entered, release, asked };
}
/** The switch over the real encrypted store, with a host that only notes what it is told. */
async function setup(register: RegisterRemoteHost, encrypted = true) {
	const root = await mkdtemp(join(tmpdir(), 'harness-remote-switch-'));
	roots.push(root);
	const config = { file: join(root, 'remote.enc'), platform: 'darwin' as const },
		store = new RemoteHostStoreAdapter({ ...config, encryption: fakeEncryption(encrypted) }),
		record = new RemoteHostRecordService(store),
		calls: string[] = [];
	const turns: RemoteHostSwitchService = new RemoteHostSwitchService({
		record,
		register,
		name: () => 'Fixture Mac',
		run: (state) => calls.push(`run ${state.generation}`),
		close: () => calls.push('close'),
		changed: () => calls.push(`changed ${turns.phase}`)
	});
	const stored = () =>
		new RemoteHostStoreAdapter({ ...config, encryption: fakeEncryption() }).read();
	return { store, record, turns, calls, stored };
}

test('turning on shows registering until the hub answered, then keeps and runs it', async () => {
	const { register, entered, release } = hub(true),
		{ record, turns, calls, stored } = await setup(register);
	const enabling = turns.enable();
	await entered.promise;
	expect([turns.phase, turns.reason]).toEqual(['registering', null]);
	expect(calls).toEqual(['changed registering']);
	expect(record.value).toBeNull();
	release.resolve();
	await enabling;
	expect([turns.phase, turns.reason]).toEqual(['idle', null]);
	expect(calls).toEqual(['changed registering', 'run 1']);
	expect(await stored()).toMatchObject({ enabled: true, origin, generation: 1 });
});

test('a refusal is shown without its words, keeps nothing and runs nothing', async () => {
	const signedOut = Object.assign(new Error('A verified hosted session is required.'), {
		signedOut: true
	});
	const cases = [
		{ failure: signedOut, shown: ['signed-out', null] },
		{ failure: new Error('hub unreachable at /internal/path'), shown: ['idle', plain] }
	];
	for (const { failure, shown } of cases) {
		const { record, turns, calls, stored } = await setup(() => Promise.reject(failure));
		await turns.enable();
		expect([turns.phase, turns.reason]).toEqual(shown);
		expect(calls).toEqual(['changed registering']);
		expect(record.value).toBeNull();
		expect(await stored()).toBeNull();
	}
});

test('turning off or quitting while registering ends that phase; the late answer changes nothing', async () => {
	for (const end of ['disable', 'stop'] as const) {
		const { register, entered, release, asked } = hub(true),
			{ record, turns, calls, stored } = await setup(register);
		const enabling = turns.enable();
		await entered.promise;
		await turns[end]();
		expect([turns.phase, turns.reason]).toEqual(['idle', null]);
		release.resolve();
		await enabling;
		expect(asked).toHaveLength(1);
		expect([turns.phase, turns.reason]).toEqual(['idle', null]);
		expect(calls).toEqual(['changed registering', 'close']);
		expect(record.value).toBeNull();
		expect(await stored()).toBeNull();
	}
});

test('launch runs what is stored as on, registers nothing, and yields to what is asked', async () => {
	const { register, asked } = hub(),
		{ store, turns, calls } = await setup(register);
	await store.save({ ...(await remoteHostIdentity()), enabled: true, origin, generation: 4 });
	await turns.start();
	expect(calls).toEqual(['run 4']);
	const starting = turns.start(),
		stopping = turns.stop();
	await Promise.all([starting, stopping]);
	expect(calls).toEqual(['run 4', 'close']);
	expect(asked).toEqual([]);
});

test('a launch does not take the place of a turning-on that is under way', async () => {
	const { register, entered, release } = hub(true),
		{ turns, calls } = await setup(register);
	const enabling = turns.enable();
	await entered.promise;
	await turns.start();
	release.resolve();
	await enabling;
	expect(calls).toEqual(['changed registering', 'run 1']);
});

test('without OS encryption nothing is read, asked of the hub or run', async () => {
	const { register, asked } = hub(),
		{ turns, calls } = await setup(register, false);
	await turns.start();
	await turns.enable();
	expect([turns.phase, turns.reason]).toEqual(['idle', null]);
	expect(asked).toEqual([]);
	expect(calls).toEqual([]);
});
