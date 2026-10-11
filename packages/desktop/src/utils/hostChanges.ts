import { appendFile, mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileHash } from './sourceSnapshot';
export function hostChanges(root: string) {
	const seen = new Map<string, Promise<string | null>>();
	const observe = (value: string) => {
		const path = isAbsolute(value) ? resolve(value) : resolve(root, value),
			inside = relative(root, path);
		if (inside && !inside.startsWith('..') && !isAbsolute(inside)) return;
		if (!seen.has(path))
			seen.set(
				path,
				fileHash(path).catch(() => null)
			);
	};
	const record = async (runId: string) => {
		const entries = await Promise.all(
			[...seen].map(async ([path, before]) => ({
				path,
				before: await before,
				after: await fileHash(path).catch(() => null),
				coverage: 'observed-cli-file-operation' as const
			}))
		);
		// The first notification can arrive after a write. Retain the operation even then.
		const changes = entries;
		if (changes.length) {
			await mkdir(resolve(root, 'work'), { recursive: true });
			await appendFile(
				resolve(root, 'work/host-changes.ndjson'),
				JSON.stringify({
					runId,
					at: new Date().toISOString(),
					coverage: 'observed CLI file operations',
					changes
				}) + '\n'
			);
		}
		return changes;
	};
	return { observe, record };
}
