import { lstat, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const reserved = new Set(['runs', 'publications', 'retention-lock', 'retention-history.jsonl']);
async function purge(path: string, cutoff: number, dryRun: boolean): Promise<number> {
	const info = await lstat(path);
	if (info.isSymbolicLink()) return 0;
	if (!info.isDirectory()) {
		if (info.mtimeMs > cutoff) return 0;
		if (!dryRun) await rm(path);
		return 1;
	}
	let removed = 0;
	for (const name of await readdir(path)) removed += await purge(join(path, name), cutoff, dryRun);
	if (!dryRun && info.mtimeMs <= cutoff && !(await readdir(path)).length)
		await rm(path, { recursive: true });
	return removed;
}
export async function reportLocalCleanup(
	root: string,
	cutoff: number,
	dryRun = false,
	knownRuns = new Set<string>()
) {
	if (!Number.isFinite(cutoff) || (await lstat(root)).isSymbolicLink())
		throw new Error('Invalid report cleanup root');
	let removed = 0;
	for (const name of await readdir(root)) {
		if (name === 'runs') {
			removed += await purgeOrphanRuns(root, cutoff, dryRun, knownRuns);
			continue;
		}
		if (reserved.has(name) || name.startsWith('.')) continue;
		removed += await purge(join(root, name), cutoff, dryRun);
	}
	return removed;
}
async function purgeOrphanRuns(root: string, cutoff: number, dryRun: boolean, known: Set<string>) {
	const directory = join(root, 'runs');
	if ((await lstat(directory)).isSymbolicLink()) throw new Error('Invalid report cleanup root');
	let removed = 0;
	for (const id of await readdir(directory)) {
		if (!known.has(id)) removed += await purge(join(directory, id), cutoff, dryRun);
	}
	return removed;
}
