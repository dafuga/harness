import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { cacheKey, readCache, writeCache } from '../../src/utils/development-tooling/cacheKey';

const identity = {
	principalId: 'github:user:12345',
	projectId: '8c3079d1-960b-4ed2-a65c-52a0b0a79c68',
	repositoryId: 123456789,
	requestedRef: 'main',
	sourceCommit: '3e272f9105c1d517920ce6d9ec1f96d66b743671',
	sourceTree: '8b1c116370acf9e873a211693bbc29d282ba8c69',
	notesRef: 'refs/heads/docs',
	notesRevision: '488235447b971fc859dc925b09defbb0db8b6155',
	evidenceRef: 'refs/heads/evidence',
	evidenceRevision: '0d6c32c577e8d671d4dc29dd54a6edc4f74ab0c5',
	historyIndexRevision: '844e3567efe28a040e704b746b46374aa0beec8a',
	artifactHash: null,
	profile: 'release'
};

function memoryCache() {
	const entries = new Map<
		string,
		{ identity: typeof identity; sha256: string; bytes: Uint8Array }
	>();
	return {
		entries,
		get: async (key: string) => entries.get(key) ?? null,
		put: async (
			key: string,
			entry: { identity: typeof identity; sha256: string; bytes: Uint8Array }
		) => {
			entries.set(key, entry);
		},
		delete: async (key: string) => {
			entries.delete(key);
		}
	};
}

test('Derives a stable key from the parsed cache identity', async () => {
	const key = await cacheKey(identity);
	const omittedRevisionKey = await cacheKey({ ...identity, collaborationRevision: undefined });
	const cases = [
		{
			name: 'derive a SHA-256 key for the supplied identity',
			input: { identity },
			output: { key }
		},
		{
			name: 'normalize an omitted collaboration revision to null',
			input: { identity: { ...identity, collaborationRevision: undefined } },
			output: { key: omittedRevisionKey, sameKey: key === omittedRevisionKey }
		}
	];
	expect(key).toMatch(/^[a-f0-9]{64}$/);
	expect(omittedRevisionKey).toBe(key);
	recordExampleCases(
		{
			unitId: 'collaboration.function.cache-key',
			symbol: 'cacheKey',
			state: 'derives-a-stable-key-from-the-parsed-cache-identity',
			evidence: 'examples-cases',
			file: 'derives-a-stable-key-from-the-parsed-cache-identity.json'
		},
		cases
	);
});

test('Writes and reads a copied cache entry', async () => {
	const cache = memoryCache();
	const bytes = new TextEncoder().encode('artifact bytes');
	await writeCache(cache, identity, bytes);
	bytes[0] = 0;
	const result = await readCache(cache, identity);
	const key = await cacheKey(identity);
	const stored = cache.entries.get(key);
	const cases = [
		{
			name: 'store and retrieve bytes without retaining the caller buffer',
			input: { identity, bytes: 'artifact bytes' },
			output: {
				stored: Boolean(stored),
				storedDigestLength: stored?.sha256.length,
				readBytes: result ? [...result] : null
			}
		}
	];
	expect(stored).toBeDefined();
	expect(result).toEqual(new TextEncoder().encode('artifact bytes'));
	recordExampleCases(
		{
			unitId: 'collaboration.function.cache-key',
			symbol: 'writeCache and readCache',
			state: 'writes-and-reads-a-copied-cache-entry',
			evidence: 'examples-cases',
			file: 'writes-and-reads-a-copied-cache-entry.json'
		},
		cases
	);
});

test('Deletes an entry with corrupted bytes', async () => {
	const cache = memoryCache();
	const bytes = new TextEncoder().encode('valid artifact');
	await writeCache(cache, identity, bytes);
	const key = await cacheKey(identity);
	const stored = cache.entries.get(key);
	if (stored) stored.bytes[0] ^= 1;
	const result = await readCache(cache, identity);
	const cases = [
		{
			name: 'remove bytes whose digest no longer matches the cache record',
			input: { identity, corrupted: true },
			output: { result, entryRemains: cache.entries.has(key) }
		}
	];
	expect(result).toBeNull();
	expect(cache.entries.has(key)).toBe(false);
	recordExampleCases(
		{
			unitId: 'collaboration.function.cache-key',
			symbol: 'readCache',
			state: 'deletes-an-entry-with-corrupted-bytes',
			evidence: 'examples-cases',
			file: 'deletes-an-entry-with-corrupted-bytes.json'
		},
		cases
	);
});
