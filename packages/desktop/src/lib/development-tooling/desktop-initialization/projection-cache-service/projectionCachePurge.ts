import { readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { CacheIdentity } from '../../../../../../collaboration/src/models/Collaboration.types';

export async function projectionCachePurge(
	directory: string,
	principalId: string,
	projectId?: string
) {
	const names = await readdir(directory).catch(() => []);
	for (const name of names) {
		if (!/^(projection|lookup)-[a-f0-9]{64}\.json$/.test(name)) continue;
		const path = join(directory, name);
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

function cacheIdentity(value: unknown): CacheIdentity | null {
	try {
		return (
			typeof value === 'string' ? Object.fromEntries(JSON.parse(value)) : value
		) as CacheIdentity | null;
	} catch {
		return null;
	}
}
