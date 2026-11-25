// @harness-uid u_k43lg2h23e
import { remoteKeys, type RemoteKeyPair } from '../../../../remote/src/index';

const database = 'harness-browser-device';
const store = 'keys';

function request<T>(source: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		source.addEventListener('success', () => resolve(source.result), { once: true });
		source.addEventListener('error', () => reject(source.error), { once: true });
	});
}

async function open(): Promise<IDBDatabase> {
	const opening = indexedDB.open(database, 1);
	opening.addEventListener('upgradeneeded', () => opening.result.createObjectStore(store));
	return request(opening);
}

/**
 * The key pair this browser presents to one of the account's computers. It is kept so a reload
 * is the same device and replaces its own session, instead of adding another device each time.
 * Without storage a fresh pair is used and nothing is remembered.
 */
export async function browserDeviceKeys(actor: string, hostId: string): Promise<RemoteKeyPair> {
	const name = `${actor}|${hostId}`;
	try {
		const db = await open();
		try {
			const kept = await request(db.transaction(store).objectStore(store).get(name));
			if (kept?.publicKey instanceof Uint8Array && kept.privateKey instanceof CryptoKey)
				return kept as RemoteKeyPair;
			const fresh = await remoteKeys();
			await request(db.transaction(store, 'readwrite').objectStore(store).put(fresh, name));
			return fresh;
		} finally {
			db.close();
		}
	} catch {
		return remoteKeys();
	}
}
