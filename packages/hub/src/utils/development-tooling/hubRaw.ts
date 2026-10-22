import { readCache, writeCache } from 'collaboration';
import type { SourceEntry } from 'collaboration';
import type { HubSourceContext } from './hubSource';
import { hubFail, hubHash } from './hubJson';
async function matches(bytes: Uint8Array, expected: string) {
	const prefix = new TextEncoder().encode(`blob ${bytes.length}\0`),
		body = new Uint8Array(prefix.length + bytes.length);
	body.set(prefix);
	body.set(bytes, prefix.length);
	return (
		[...new Uint8Array(await crypto.subtle.digest('SHA-1', body))]
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('') === expected
	);
}
export async function hubRaw(context: HubSourceContext, entry: SourceEntry): Promise<Uint8Array> {
	const prefetched = context.metadata?.get(entry.path);
	if (prefetched) {
		if (!(await matches(prefetched, entry.sha))) return hubFail();
		return new Uint8Array(prefetched);
	}
	const identity = {
		...context.identity,
		collaborationRevision: null,
		artifactHash: null,
		profile: await hubBlobProfile('raw', entry.path, entry.sha)
	};
	const cached = await readCache(context.cache, identity);
	if (cached && (await matches(cached, entry.sha))) return cached;
	const bytes = await context.source.raw(context.repository, {
		commit: context.commit,
		path: entry.path
	});
	if (!(await matches(bytes, entry.sha))) return hubFail();
	await writeCache(context.cache, identity, bytes);
	return bytes;
}
export async function hubMaterializedHash(raw: Uint8Array, expected: string | null) {
	const text = new TextDecoder().decode(raw);
	if (!text.startsWith('version https://git-lfs.github.com/spec/')) {
		if (expected && (await hubHash(raw)) !== expected) return hubFail();
		return { hash: await hubHash(raw), size: raw.length, lfs: false };
	}
	const match =
		/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (0|[1-9]\d*)\n?$/.exec(
			text
		);
	if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) > 50000000)
		return hubFail();
	if (expected && expected !== match[1]) return hubFail();
	return { hash: match[1], size: Number(match[2]), lfs: true };
}

export async function hubBlobProfile(kind: string, path: string, sha: string) {
	return `${kind}:${await hubHash(path)}:${sha}`;
}
