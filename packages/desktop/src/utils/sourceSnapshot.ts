import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gitRead } from './gitRead';
export type SourceSnapshot = Map<string, string>;
export async function fileHash(path: string): Promise<string | null> {
	try {
		const stat = await lstat(path);
		if (stat.isSymbolicLink()) return 'link:' + (await readlink(path));
		if (!stat.isFile()) return null;
		const hash = createHash('sha256');
		for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
		return hash.digest('hex');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}
export async function sourceSnapshot(root: string): Promise<SourceSnapshot> {
	const tracked = await gitRead(root, [
		'ls-files',
		'--cached',
		'--others',
		'--exclude-standard',
		'-z'
	]);
	const paths = [...new Set(tracked.split('\0').filter(Boolean))];
	const entries = await Promise.all(
		paths.map(async (path) => [path, await fileHash(resolve(root, path))] as const)
	);
	return new Map(entries.filter((entry): entry is readonly [string, string] => entry[1] !== null));
}
