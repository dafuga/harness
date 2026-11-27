// @harness-uid u_tb5vh2cjta
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TrackerBundleRecord } from './TrackerBundleService.types';

const staleLock = 10 * 60 * 1000;
const keptReleases = 3;

export async function readRecord(file: string): Promise<TrackerBundleRecord> {
	try {
		const record = JSON.parse(await readFile(file, 'utf8')) as TrackerBundleRecord;
		if (record.version === 1 && Array.isArray(record.releases)) return record;
	} catch {
		// A missing or damaged record only means no earlier release is known.
	}
	return { version: 1, releases: [], current: null, revision: null };
}

export async function writeRecord(file: string, record: TrackerBundleRecord): Promise<void> {
	await mkdir(dirname(file), { recursive: true, mode: 0o700 });
	const staged = `${file}.${process.pid}.tmp`;
	await writeFile(staged, `${JSON.stringify(record, null, '\t')}\n`, { mode: 0o600 });
	await rename(staged, file);
}

/** Adds a release and removes only older releases this bundle itself staged. */
export async function recordRelease(
	input: { file: string; releases: string; revision: string },
	release: string,
	keep: string[]
): Promise<TrackerBundleRecord> {
	const record = await readRecord(input.file);
	const known = [...record.releases.filter((id) => id !== release), release];
	const protectedIds = new Set([release, ...keep]);
	const excess = known.length - keptReleases;
	const removable = excess > 0 ? known.filter((id) => !protectedIds.has(id)).slice(0, excess) : [];
	for (const id of removable) await rm(join(input.releases, id), { recursive: true, force: true });
	const next = {
		version: 1 as const,
		releases: known.filter((id) => !removable.includes(id)),
		current: release,
		revision: input.revision
	};
	await writeRecord(input.file, next);
	return next;
}

/** One installer at a time; a lock older than ten minutes belongs to a dead process. */
export async function withLock<T>(file: string, work: () => Promise<T>): Promise<T | null> {
	await mkdir(dirname(file), { recursive: true, mode: 0o700 });
	const acquire = async () => (await open(file, 'wx', 0o600)).close();
	try {
		await acquire();
	} catch {
		const age = Date.now() - (await stat(file).catch(() => ({ mtimeMs: 0 }))).mtimeMs;
		if (age < staleLock) return null;
		await rm(file, { force: true });
		await acquire().catch(() => null);
	}
	try {
		return await work();
	} finally {
		await rm(file, { force: true });
	}
}
