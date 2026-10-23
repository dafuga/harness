import type { HostFixture } from './remote-host-holds.types';
import { deferred } from './remote-fixture';
import type { hostFixture } from './remote-host-fixture';

/**
 * The real encrypted store with its first read, or its first write, held open until released.
 * A held write keeps what it was given when it was called, as the real store seals it then.
 */
export function heldStore(f: HostFixture, held: 'read' | 'save') {
	const store = f.storeFor(),
		entered = deferred(),
		release = deferred(),
		read = store.read.bind(store),
		save = store.save.bind(store);
	let waited = false;
	const hold = async (operation: 'read' | 'save') => {
		if (waited || operation !== held) return;
		waited = true;
		entered.resolve();
		await release.promise;
	};
	store.read = async () => {
		await hold('read');
		return read();
	};
	store.save = async (state) => {
		const given = structuredClone(state);
		await hold('save');
		return save(given);
	};
	return { store, entered, release };
}
/** A computer that was turned on and then quit: what is stored says remote access is on. */
export async function turnedOn(f: HostFixture): Promise<number> {
	await f.host.enable();
	await f.online();
	await f.host.stop();
	return f.relay.bearers.length;
}
/** What is stored about being on; false when nothing is stored at all. */
export async function storedOn(f: HostFixture): Promise<boolean> {
	return (await f.storeFor().read())?.enabled ?? false;
}

export type { HostFixture } from './remote-host-holds.types';
