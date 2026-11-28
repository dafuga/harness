import { sealedDevice } from '../../../../../remote/src/utils/networking-security/sealedDevice';
import type { BrowserEnrollment, BrowserEnrollmentRecord } from './browserEnrollmentStore.types';

const store = 'installations';

export async function openBrowserEnrollments(): Promise<IDBDatabase> {
	const opening = indexedDB.open('harness-browser-approval', 1);
	opening.addEventListener('upgradeneeded', () => opening.result.createObjectStore(store));
	return request(opening);
}

async function request<T>(operation: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		operation.addEventListener('success', () => resolve(operation.result), { once: true });
		operation.addEventListener('error', () => reject(operation.error), { once: true });
	});
}

export async function readBrowserEnrollment(
	db: IDBDatabase,
	account: string
): Promise<BrowserEnrollmentRecord> {
	const record = await request<BrowserEnrollmentRecord | undefined>(
		db.transaction(store).objectStore(store).get(account)
	);
	return record ?? {};
}

/** Wait for the database commit. A reveal must never outrun its durable claim pin. */
export async function keepBrowserEnrollment(
	db: IDBDatabase,
	account: string,
	record: BrowserEnrollmentRecord
): Promise<void> {
	const writing = db.transaction(store, 'readwrite', { durability: 'strict' });
	const settled = new Promise<void>((resolve, reject) => {
		writing.addEventListener('complete', () => resolve(), { once: true });
		writing.addEventListener('abort', () => reject(writing.error), { once: true });
	});
	writing.objectStore(store).put(record, account);
	await settled;
}

export async function resolveBrowserEnrollment(
	db: IDBDatabase,
	account: string
): Promise<BrowserEnrollment> {
	const record = await readBrowserEnrollment(db, account);
	if (record.installation) return record.installation;
	const device = await sealedDevice();
	const progress = {
		nonce: crypto.getRandomValues(new Uint8Array(32)),
		accountPin: record.accountPin
	};
	const installation = { device, progress };
	await keepBrowserEnrollment(db, account, { ...record, installation });
	return installation;
}
