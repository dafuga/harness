import type { Page } from '@playwright/test';
import type { ScopeKeys } from '../../../remote/src/models/networking-security/Sealed.types';
import type { SeedCache } from './sealed-home-fixture.types';
import { ada } from './hosted-data';
import { sealedChainEntry } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedRecord } from '../../../remote/src/utils/networking-security/sealedRecord';
import {
	sealedObjectId,
	sealedScopeKeys
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';

export async function seedSealedHome(page: Page) {
	const account = ada.id;
	const scopeId = new Uint8Array(16).fill(7);
	const dataKey = new Uint8Array(32).fill(11);
	const indexKey = new Uint8Array(32).fill(13);
	const keys = await sealedScopeKeys({ scopeId, dataKey, indexKey, epoch: 0 });
	const scope = toBase64Url(scopeId);
	const device = await sealedDevice();
	const publicDevice = sealedDevicePublic(device, 'admin', [scope]);
	const entry = await sealedChainEntry(device, {
		seq: 0,
		prev: '',
		at: 1,
		by: device.deviceId,
		body: {
			type: 'genesis',
			account,
			devices: [publicDevice],
			scopes: [{ scope, epoch: 0, commitment: toBase64Url(keys.commitment) }]
		}
	});
	const streamId = new Uint8Array(16).fill(5);
	const stream = toBase64Url(streamId);
	const objects = await seedObjects(keys, stream);
	await seedCache(page, {
		account,
		scope,
		keys: { scopeId: [...keys.scopeId], commitment: [...keys.commitment] },
		dataKey: [...dataKey],
		indexKey: [...indexKey],
		entry,
		deviceId: device.deviceId,
		objects
	});
	return { scope, keys, streamId, device, entry, objects };
}

async function seedObjects(keys: ScopeKeys, stream: string) {
	const status = {
		kind: 'session',
		runId: 'fixture-run',
		streamId: stream,
		details: { title: 'Synthetic Mac session' },
		status: 'running'
	};
	const segment = {
		kind: 'transcript',
		runId: 'fixture-run',
		index: 0,
		data: toBase64Url(new TextEncoder().encode('Cached transcript canary'))
	};
	return Promise.all(
		[status, segment].map(async (value) => {
			const objectId = await sealedObjectId(
				keys,
				value.kind,
				value.kind === 'session' ? value.runId : JSON.stringify([value.runId, 0])
			);
			return {
				id: toBase64Url(objectId),
				revision: 1,
				envelope: toBase64Url(await sealedRecord(keys, { objectId, revision: 1n }, value))
			};
		})
	);
}

async function seedCache(page: Page, input: SeedCache) {
	// Chromium imports synthetic keys independently. No production data or credential is used.
	await page.route('**/sealed-fixture-origin', (route) =>
		route.fulfill({ body: '<!doctype html>', contentType: 'text/html' })
	);
	await page.goto('/sealed-fixture-origin');
	await page.evaluate(
		async ({ account, scope, keys, dataKey, indexKey, entry, deviceId, objects }) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('harness-sealed-v1', 1);
				request.onupgradeneeded = () => request.result.createObjectStore('sealed');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
			});
			const imported = {
				scopeId: Uint8Array.from(keys.scopeId),
				epoch: 0,
				commitment: Uint8Array.from(keys.commitment),
				dataKey: await crypto.subtle.importKey('raw', Uint8Array.from(dataKey), 'HKDF', false, [
					'deriveKey',
					'deriveBits'
				]),
				indexKey: await crypto.subtle.importKey(
					'raw',
					Uint8Array.from(indexKey),
					{ name: 'HMAC', hash: 'SHA-256' },
					false,
					['sign']
				)
			};
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction('sealed', 'readwrite');
				tx.oncomplete = () => resolve();
				tx.onabort = () => reject(tx.error);
				const store = tx.objectStore('sealed');
				store.put({ deviceId, entries: [entry] }, [account, 'enrollment']);
				store.put(imported, [account, 'key', scope, 0]);
				for (const object of objects) store.put(object, [account, 'object', scope, object.id]);
				store.put(2, [account, 'cursor', scope]);
			});
			db.close();
		},
		input
	);
}

export async function inspectSealedHome(page: Page, scope: string, id: string) {
	return page.evaluate(
		async ({ account, scope, id }) => {
			const result = <T>(request: IDBRequest<T>) =>
				new Promise<T>((resolve, reject) => {
					request.onerror = () => reject(request.error);
					request.onsuccess = () => resolve(request.result);
				});
			const db = await result(indexedDB.open('harness-sealed-v1', 1));
			try {
				const store = db.transaction('sealed').objectStore('sealed');
				const [cursor, row, keys] = await Promise.all([
					result(store.get([account, 'cursor', scope])),
					result(store.get([account, 'object', scope, id])),
					result(store.get([account, 'key', scope, 0]))
				]);
				return {
					cursor,
					envelope: row.envelope,
					extractable: [keys.dataKey.extractable, keys.indexKey.extractable]
				};
			} finally {
				db.close();
			}
		},
		{ account: ada.id, scope, id }
	);
}
