import type { CacheEntry, CollaborationCache } from 'collaboration';
/** R2 is a disposable projection store. Authority always comes from GitHub before use. */
export function hubCache(bucket?: R2Bucket): CollaborationCache {
	if (bucket)
		return {
			get: (key) => readBucket(bucket, key),
			put: (key, entry) => saveBucket(bucket, key, entry),
			delete: (key) => bucket.delete('projections/' + key).catch(() => {})
		};
	const memory = new Map<string, CacheEntry>();
	return {
		get: async (key) => memory.get(key) ?? null,
		async put(key, entry) {
			memory.set(key, structuredClone(entry));
		},
		async delete(key) {
			memory.delete(key);
		}
	};
}

async function readBucket(bucket: R2Bucket, key: string): Promise<CacheEntry | null> {
	try {
		const object = await bucket.get('projections/' + key);
		if (!object) return null;
		return {
			identity: JSON.parse(object.customMetadata?.identity ?? 'null') as CacheEntry['identity'],
			sha256: object.customMetadata?.sha256 ?? '',
			bytes: new Uint8Array(await object.arrayBuffer())
		};
	} catch {
		return null;
	}
}

async function saveBucket(bucket: R2Bucket, key: string, entry: CacheEntry): Promise<void> {
	await bucket
		.put('projections/' + key, new Uint8Array(entry.bytes), {
			customMetadata: { identity: JSON.stringify(entry.identity), sha256: entry.sha256 }
		})
		.catch(() => {});
}
