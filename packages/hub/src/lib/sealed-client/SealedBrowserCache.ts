// @harness-uid u_j5kk77ld3m
import type { ScopeKeys } from '../../../../remote/src/models/networking-security/Sealed.types';
import type {
	SealedEnrollment,
	SealedObject,
	SealedObjectPage,
	StoredGrant
} from './SealedBrowserCache.types';

const storeName = 'sealed';

function result<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function committed(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error);
	});
}

async function write<T>(
	db: IDBDatabase,
	update: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
	const tx = db.transaction(storeName, 'readwrite');
	const done = committed(tx);
	try {
		const [value] = await Promise.all([update(tx.objectStore(storeName)), done]);
		return value;
	} catch (error) {
		try {
			tx.abort();
		} catch {
			/* The transaction has already finished. */
		}
		throw error;
	}
}

/** The only durable browser copy contains wire ciphertext, opaque cursors and local CryptoKeys. */
export class SealedBrowserCache {
	private constructor(
		private db: IDBDatabase,
		private account: string
	) {}

	static async open(account: string): Promise<SealedBrowserCache> {
		const request = indexedDB.open('harness-sealed-v1', 1);
		request.onupgradeneeded = () => request.result.createObjectStore(storeName);
		const db = await result(request);
		db.onversionchange = () => db.close();
		return new SealedBrowserCache(db, account);
	}

	close(): void {
		this.db.close();
	}

	enrollment(): Promise<SealedEnrollment | undefined> {
		return this.read(['enrollment']);
	}

	keys(scope: string, epoch: number): Promise<ScopeKeys | undefined> {
		return this.read(['key', scope, epoch]);
	}

	objects(scope: string): Promise<SealedObject[]> {
		const prefix = [this.account, 'object', scope];
		const range = IDBKeyRange.bound(prefix, [...prefix, []], true, true);
		return result(this.db.transaction(storeName).objectStore(storeName).getAll(range));
	}

	async cursor(scope: string): Promise<number> {
		return (await this.read<number>(['cursor', scope])) ?? 0;
	}

	/** Compare and advance the cursor in the same transaction as the envelope writes. */
	applyPage(scope: string, page: SealedObjectPage): Promise<boolean> {
		return write(this.db, async (store) => {
			const key = [this.account, 'cursor', scope];
			const current = (await result(store.get(key))) ?? 0;
			if (current !== page.after) return false;
			await Promise.all(
				page.objects.map(async (object) => {
					const address = [this.account, 'object', scope, object.id];
					const previous: SealedObject | undefined = await result(store.get(address));
					if (!previous || previous.revision < object.revision) store.put(object, address);
				})
			);
			store.put(page.next, key);
			return true;
		});
	}

	/** Store an authenticated chain extension and its new grants without losing a newer pin. */
	saveEnrollment(enrollment: SealedEnrollment, grants: StoredGrant[]): Promise<boolean> {
		return write(this.db, async (store) => {
			const key = [this.account, 'enrollment'];
			const previous: SealedEnrollment | undefined = await result(store.get(key));
			if (
				previous &&
				(previous.deviceId !== enrollment.deviceId ||
					previous.entries.at(-1)?.sig !== enrollment.entries[previous.entries.length - 1]?.sig)
			)
				return false;
			store.put(enrollment, key);
			for (const { scope, keys } of grants)
				store.put(keys, [this.account, 'key', scope, keys.epoch]);
			return true;
		});
	}

	private read<T>(key: IDBValidKey[]): Promise<T | undefined> {
		return result(
			this.db
				.transaction(storeName)
				.objectStore(storeName)
				.get([this.account, ...key])
		);
	}
}
