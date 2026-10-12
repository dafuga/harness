import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
function identityKey(identity: CacheIdentity): string {
	return JSON.stringify(
		Object.entries(identity).sort(([left], [right]) => left.localeCompare(right))
	);
}
/** A projection cannot authorize access. Callers must revalidate authority before each read. */
export class ProjectionCacheService {
	generation = 0;
	constructor(private directory: string) {}
	async get(identity: CacheIdentity, expectedHash: string): Promise<Uint8Array | null> {
		try {
			const entry = JSON.parse(await readFile(this.path(identity), 'utf8'));
			const bytes = new Uint8Array(Buffer.from(entry.bytes, 'base64'));
			if (
				entry.identity !== identityKey(identity) ||
				entry.hash !== expectedHash ||
				digest(bytes) !== expectedHash
			)
				return null;
			return bytes;
		} catch {
			return null;
		}
	}
	async put(identity: CacheIdentity, bytes: Uint8Array, expectedHash: string): Promise<void> {
		const generation = this.generation;
		if (!/^[a-f0-9]{64}$/.test(expectedHash) || digest(bytes) !== expectedHash)
			throw new Error('Cache hash mismatch.');
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		await writeFile(
			this.path(identity),
			JSON.stringify({
				identity: identityKey(identity),
				hash: expectedHash,
				bytes: Buffer.from(bytes).toString('base64')
			}),
			{ mode: 0o600 }
		);
		await this.checkGeneration(generation, this.path(identity));
	}
	async remember(scope: string, identity: CacheIdentity, value: unknown): Promise<string> {
		const generation = this.generation;
		const bytes = Buffer.from(JSON.stringify(value));
		const hash = digest(bytes),
			cachedAt = new Date().toISOString();
		const bound = {
			...identity,
			profile: JSON.stringify([identity.profile, scope]),
			artifactHash: hash
		};
		await this.put(bound, bytes, hash);
		await this.checkGeneration(generation, this.path(bound));
		await writeFile(
			join(this.directory, `lookup-${digest(scope)}.json`),
			JSON.stringify({ identity: bound, original: identity, hash, cachedAt }),
			{ mode: 0o600 }
		);
		await this.checkGeneration(generation, join(this.directory, `lookup-${digest(scope)}.json`));
		return cachedAt;
	}
	async lookup(
		scope: string
	): Promise<{ value: unknown; identity: CacheIdentity; cachedAt: string } | null> {
		try {
			const entry = JSON.parse(
				await readFile(join(this.directory, `lookup-${digest(scope)}.json`), 'utf8')
			);
			if (!entry.cachedAt || !Number.isFinite(Date.parse(entry.cachedAt))) return null;
			const expected = {
				...entry.original,
				profile: JSON.stringify([entry.original.profile, scope]),
				artifactHash: entry.hash
			};
			if (identityKey(expected) !== identityKey(entry.identity)) return null;
			const bytes = await this.get(entry.identity, entry.hash);
			return bytes
				? {
						value: JSON.parse(Buffer.from(bytes).toString()),
						identity: entry.original,
						cachedAt: entry.cachedAt
					}
				: null;
		} catch {
			return null;
		}
	}
	async purge(principalId: string, projectId?: string): Promise<void> {
		this.generation++;
		const names = await readdir(this.directory).catch(() => []);
		for (const name of names) {
			if (!/^(projection|lookup)-[a-f0-9]{64}\.json$/.test(name)) continue;
			const path = join(this.directory, name);
			const entry = await readFile(path, 'utf8')
				.then((text) => JSON.parse(text))
				.catch(() => ({}));
			const identity = cacheIdentity(entry.identity);
			if (!identity) {
				await unlink(path);
				continue;
			}
			if (
				identity?.principalId === principalId &&
				(!projectId || identity.projectId === projectId || identity.projectId === '$projects')
			)
				await unlink(path);
		}
	}
	async clear(): Promise<void> {
		this.generation++;
		const names = await readdir(this.directory).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		});
		for (const name of names)
			if (/^(projection|lookup)-[a-f0-9]{64}\.json$/.test(name))
				await unlink(join(this.directory, name));
	}
	private async checkGeneration(generation: number, path: string) {
		if (generation === this.generation) return;
		await unlink(path).catch(() => undefined);
		throw new Error('Cached authority changed during the read.');
	}
	private path(identity: CacheIdentity): string {
		return join(this.directory, `projection-${digest(identityKey(identity))}.json`);
	}
}

function cacheIdentity(value: unknown): CacheIdentity | null {
	try {
		return (
			typeof value === 'string' ? Object.fromEntries(JSON.parse(value)) : value
		) as CacheIdentity | null;
	} catch {
		return null;
	}
}
