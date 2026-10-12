import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RemoteHostStoreAdapter } from '../../src/adapters/RemoteHostStoreAdapter';
import { RemoteHostRecordService } from '../../src/services/RemoteHostRecordService';
import { remoteHostIdentity } from '../../src/utils/remoteHostIdentity';
import { deferred } from '../remote-fixture';
import { fakeEncryption } from '../remote-host-fixture';

const roots: string[] = [];
const on = { enabled: true, origin: 'https://relay.example', generation: 1 };
const wanted = () => true;
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
/** The real encrypted store in a directory of its own, and a new identity that is not stored. */
async function setup() {
	const root = await mkdtemp(join(tmpdir(), 'harness-remote-record-'));
	roots.push(root);
	const config = { file: join(root, 'remote.enc'), encryption: fakeEncryption() },
		store = new RemoteHostStoreAdapter({ ...config, platform: 'darwin' }),
		stored = () => new RemoteHostStoreAdapter({ ...config, platform: 'darwin' }).read();
	return {
		store,
		stored,
		record: new RemoteHostRecordService(store),
		state: await remoteHostIdentity()
	};
}
/** Holds the first write open and notes, by generation, when each write starts and ends. */
function slowWrites(store: RemoteHostStoreAdapter) {
	const entered = deferred(),
		release = deferred(),
		save = store.save.bind(store),
		order: string[] = [];
	store.save = async (state) => {
		const given = structuredClone(state),
			first = order.length === 0;
		order.push(`start ${given.generation}`);
		if (first) entered.resolve();
		if (first) await release.promise;
		await save(given);
		order.push(`end ${given.generation}`);
	};
	return { entered, release, order };
}

test('what is stored is read once, however many ask, and is the one copy', async () => {
	const { store, record, state } = await setup();
	await store.save({ ...state, ...on });
	const read = store.read.bind(store);
	let reads = 0;
	store.read = () => {
		reads += 1;
		return read();
	};
	const [first, second] = await Promise.all([record.load(), record.load()]);
	expect(first).toMatchObject({ hostId: state.hostId, enabled: true });
	expect(second).toBe(first);
	expect(await record.load()).toBe(first);
	expect(record.value).toBe(first);
	expect(reads).toBe(1);
});

test('a read that failed is tried again, and nothing stored is no record', async () => {
	const { store, record } = await setup(),
		read = store.read.bind(store);
	let failing = true;
	store.read = () => (failing ? Promise.reject(new Error('unreadable')) : read());
	await expect(record.load()).rejects.toThrow('unreadable');
	failing = false;
	expect(await record.load()).toBeNull();
	expect(record.value).toBeNull();
	await record.save();
	expect(await store.read()).toBeNull();
});

test('writes land in the order asked, each with the record as it is at its turn', async () => {
	const { store, stored, record, state } = await setup(),
		{ entered, release, order } = slowWrites(store);
	const first = record.enrol(state, on, wanted);
	await entered.promise;
	state.generation = 2;
	const second = record.save();
	state.generation = 3;
	const third = record.save();
	release.resolve();
	await Promise.all([first, second, third]);
	expect(order).toEqual(['start 1', 'end 1', 'start 3', 'end 3', 'start 3', 'end 3']);
	expect(await stored()).toMatchObject({ enabled: true, generation: 3 });
});

test('off is the last word over a registration that is still being written', async () => {
	const { store, stored, record, state } = await setup(),
		{ entered, release } = slowWrites(store);
	const enrolling = record.enrol(state, on, wanted);
	await entered.promise;
	const off = record.off();
	expect(record.value?.enabled).toBe(false);
	release.resolve();
	expect(await enrolling).toBe(true);
	await off;
	expect(await stored()).toMatchObject({ enabled: false, origin: on.origin, generation: 1 });
});

test('off waits for a record that is still being read, and without a record writes nothing', async () => {
	const { store, stored, record, state } = await setup();
	await record.off();
	expect(await stored()).toBeNull();
	await store.save({ ...state, ...on });
	const later = new RemoteHostRecordService(store),
		loading = later.load();
	await later.off();
	expect((await loading)?.enabled).toBe(false);
	expect(await stored()).toMatchObject({ enabled: false });
});

test('a registration that is no longer wanted when its turn comes changes nothing', async () => {
	const { store, stored, record, state } = await setup(),
		{ entered, release } = slowWrites(store);
	let latest = true;
	const first = record.enrol(state, on, wanted);
	await entered.promise;
	const other = await remoteHostIdentity(),
		second = record.enrol(other, { ...on, generation: 9 }, () => latest);
	latest = false;
	release.resolve();
	expect(await first).toBe(true);
	expect(await second).toBe(false);
	expect(other).toMatchObject({ enabled: false, origin: null, generation: 0 });
	expect(record.value).toBe(state);
	expect(await stored()).toMatchObject({ hostId: state.hostId, generation: 1 });
});

test('a registration whose write fails is taken back and never undoes an off', async () => {
	const { store, record, state } = await setup(),
		save = store.save.bind(store);
	store.save = () => Promise.reject(new Error('no space left'));
	await expect(record.enrol(state, on, wanted)).rejects.toThrow('no space left');
	expect(state).toMatchObject({ enabled: false, origin: null, generation: 0 });
	expect(record.value).toBeNull();
	store.save = save;
	await record.enrol(state, on, wanted);
	const writing = deferred();
	store.save = () => {
		writing.resolve();
		return new Promise((_, reject) => setTimeout(() => reject(new Error('gone')), 20));
	};
	const again = record.enrol(state, { ...on, generation: 2 }, wanted);
	await writing.promise;
	const off = record.off().catch(() => 'not written');
	await expect(again).rejects.toThrow('gone');
	expect(await off).toBe('not written');
	expect(record.value).toMatchObject({ enabled: false, generation: 1 });
	await record.settled();
});
