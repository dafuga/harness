import { z } from 'zod';
import type {
	CacheIdentity,
	CollaborationCache
} from '../../models/planning-collaboration/Collaboration.types';
import {
	digest,
	fail,
	hash,
	id,
	label,
	parse,
	sha
} from '../planning-collaboration/parseCollaborationInput';
const reference = z.string().min(1).max(1024);
const schema = z.strictObject({
	collaborationRevision: sha.nullable().default(null),
	principalId: label,
	projectId: id,
	repositoryId: z.number().int().positive(),
	requestedRef: reference,
	sourceCommit: sha,
	sourceTree: sha,
	notesRef: reference.nullable(),
	notesRevision: sha.nullable(),
	evidenceRef: reference.nullable(),
	evidenceRevision: sha.nullable(),
	historyIndexRevision: sha.nullable(),
	artifactHash: hash.nullable(),
	profile: label.nullable()
});
export async function cacheKey(identity: CacheIdentity): Promise<string> {
	return digest(new TextEncoder().encode(JSON.stringify(parse(schema, identity))));
}
export async function readCache(
	cache: CollaborationCache,
	identity: CacheIdentity
): Promise<Uint8Array | null> {
	const key = await cacheKey(identity);
	try {
		const entry = await cache.get(key);
		if (!entry) return null;
		if (
			(await cacheKey(entry.identity)) !== key ||
			(await digest(entry.bytes)) !== entry.sha256 ||
			(identity.artifactHash && identity.artifactHash !== entry.sha256)
		)
			throw new Error('Corrupt cache');
		return new Uint8Array(entry.bytes);
	} catch {
		await cache.delete(key);
		return null;
	}
}
export async function writeCache(
	cache: CollaborationCache,
	identity: CacheIdentity,
	bytes: Uint8Array
): Promise<void> {
	const key = await cacheKey(identity);
	const sha256 = await digest(bytes);
	if (identity.artifactHash && identity.artifactHash !== sha256) return fail('cache-hash-mismatch');
	await cache.put(key, { identity: parse(schema, identity), sha256, bytes: new Uint8Array(bytes) });
}
