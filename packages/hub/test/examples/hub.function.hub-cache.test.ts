import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubCache } from '../../src/routes/api/[...path]/hubCache';
import type { Entry, StoredObject } from './hub.function.hub-cache.test.types';

const identity = { repo: 'fixture-repo', issue: 42 } as unknown as Entry['identity'];

function makeEntry(bytes: number[]): Entry {
	return { identity, sha256: 'fixture-sha-256', bytes: new Uint8Array(bytes) };
}

function meta(state: string) {
	return {
		unitId: 'hub.function.hub-cache',
		symbol: 'hubCache',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

/** In-memory stand-in for an R2 bucket: records what hubCache writes, performs no I/O. */
function fakeBucket(): { bucket: R2Bucket; store: Map<string, StoredObject> } {
	const store = new Map<string, StoredObject>();
	const bucket = {
		async get(key: string) {
			const found = store.get(key);
			if (!found) return null;
			return {
				customMetadata: found.customMetadata,
				arrayBuffer: async () => found.bytes.slice().buffer
			};
		},
		async put(key: string, value: Uint8Array, options: { customMetadata: Record<string, string> }) {
			store.set(key, { bytes: new Uint8Array(value), customMetadata: options.customMetadata });
		},
		async delete(key: string) {
			store.delete(key);
		}
	};
	return { bucket: bucket as unknown as R2Bucket, store };
}

test('Memory cache returns a cloned copy of stored entries', async () => {
	const cache = hubCache();
	const entry = makeEntry([1, 2, 3]);
	await cache.put('fixture-key', entry);
	entry.bytes[0] = 9;
	const first = await cache.get('fixture-key');
	const second = await cache.get('fixture-key');
	expect(first).toEqual(makeEntry([1, 2, 3]));
	expect(second).toBe(first);
	expect(await cache.get('missing-key')).toBeNull();
	recordExampleCases(meta('memory-cache-returns-a-cloned-copy-of-stored-entries'), [
		{
			name: 'entry is stored and read back as a clone',
			input: { key: 'fixture-key', bytes: [1, 2, 3] },
			output: { identity, sha256: 'fixture-sha-256', bytes: [1, 2, 3] }
		},
		{ name: 'missing key returns null', input: { key: 'missing-key' }, output: null }
	]);
});

test('Memory cache deletes entries and keeps caches separate', async () => {
	const cache = hubCache();
	await cache.put('fixture-key', makeEntry([4, 5]));
	await cache.delete('fixture-key');
	await cache.delete('never-stored');
	expect(await cache.get('fixture-key')).toBeNull();
	expect(await hubCache().get('fixture-key')).toBeNull();
	recordExampleCases(meta('memory-cache-deletes-entries-and-keeps-caches-separate'), [
		{
			name: 'deleted key reads back as null',
			input: { key: 'fixture-key' },
			output: null
		},
		{
			name: 'deleting an unknown key resolves without error',
			input: { key: 'never-stored' },
			output: null
		},
		{
			name: 'a new cache does not see another cache entries',
			input: { key: 'fixture-key', freshCache: true },
			output: null
		}
	]);
});

test('Memory cache rejects entries that cannot be cloned', async () => {
	const cache = hubCache();
	const uncloneable = {
		identity: { describe: () => 'fixture' },
		sha256: 'fixture-sha-256',
		bytes: new Uint8Array([7])
	} as unknown as Entry;
	const error = await cache.put('fixture-key', uncloneable).catch((caught: unknown) => caught);
	expect((error as { name?: string }).name).toBe('DataCloneError');
	expect(await cache.get('fixture-key')).toBeNull();
	recordExampleCases(meta('memory-cache-rejects-entries-that-cannot-be-cloned'), [
		{
			name: 'entry holding a function is not stored',
			input: { key: 'fixture-key', identity: '[function field]' },
			error: 'DataCloneError'
		}
	]);
});

test('R2 cache stores entries under the projections prefix', async () => {
	const { bucket, store } = fakeBucket();
	const cache = hubCache(bucket);
	await cache.put('fixture-key', makeEntry([1, 2, 3]));
	expect([...store.keys()]).toEqual(['projections/fixture-key']);
	expect(store.get('projections/fixture-key')?.customMetadata).toEqual({
		identity: JSON.stringify(identity),
		sha256: 'fixture-sha-256'
	});
	expect(await cache.get('fixture-key')).toEqual(makeEntry([1, 2, 3]));
	expect(await cache.get('missing-key')).toBeNull();
	await cache.delete('fixture-key');
	expect(store.size).toBe(0);
	recordExampleCases(meta('r2-cache-stores-entries-under-the-projections-prefix'), [
		{
			name: 'put writes object with identity and sha256 metadata',
			input: { key: 'fixture-key', bytes: [1, 2, 3] },
			output: {
				storedKey: 'projections/fixture-key',
				identity: JSON.stringify(identity),
				sha256: 'fixture-sha-256'
			}
		},
		{
			name: 'get returns the stored entry',
			input: { key: 'fixture-key' },
			output: { sha256: 'fixture-sha-256', bytes: [1, 2, 3] }
		},
		{ name: 'missing object returns null', input: { key: 'missing-key' }, output: null },
		{ name: 'delete removes the object', input: { key: 'fixture-key' }, output: 0 }
	]);
});

test('R2 put rejects identities that cannot be serialised', async () => {
	const { bucket, store } = fakeBucket();
	const circular: Record<string, unknown> = { repo: 'fixture-repo' };
	circular.self = circular;
	const circularEntry = {
		identity: circular,
		sha256: 'fixture-sha-256',
		bytes: new Uint8Array([1])
	} as unknown as Entry;
	const error = await hubCache(bucket)
		.put('fixture-key', circularEntry)
		.catch((caught: unknown) => caught);
	expect((error as { name?: string }).name).toBe('TypeError');
	expect(store.size).toBe(0);
	recordExampleCases(meta('r2-put-rejects-identities-that-cannot-be-serialised'), [
		{
			name: 'circular identity fails JSON encoding before the write',
			input: { key: 'fixture-key', identity: 'circular reference' },
			error: 'TypeError'
		}
	]);
});
