import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { reviewHash } from './cleanCodeFiles';
import type { ReviewSnapshot } from './cleanCodeSnapshot';
import type { CleanCodeSettings, JevEvaluation } from './cleanCodeTypes';
import { cleanCodeRubricVersion } from './cleanCodeRubric';

export interface CachedEvaluation {
	evaluation: JevEvaluation;
	localization?: JevEvaluation;
}

export function reviewCacheKey(snapshot: ReviewSnapshot, settings: CleanCodeSettings): string {
	return reviewHash(
		JSON.stringify({
			provider: 'https://api.typesafe.ai',
			rubric: cleanCodeRubricVersion,
			settings,
			state: snapshot.state,
			contextHash: snapshot.contextHash
		})
	);
}

export async function readReviewCache(root: string, key: string): Promise<unknown> {
	try {
		const directory = await cacheDirectory(root, false);
		const path = join(directory, `${key}.json`);
		if ((await realpath(path)) !== path) return undefined;
		return JSON.parse(await readFile(path, 'utf8')) as unknown;
	} catch {
		return undefined;
	}
}

export async function writeReviewCache(
	root: string,
	key: string,
	value: CachedEvaluation
): Promise<void> {
	try {
		const directory = await cacheDirectory(root, true);
		const temporary = join(directory, `${key}.${randomUUID()}.tmp`);
		await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
		await rename(temporary, join(directory, `${key}.json`));
	} catch {
		// Cache availability must not decide whether a real review succeeds.
	}
}

async function cacheDirectory(root: string, create: boolean): Promise<string> {
	const directory = join(root, '.cache/harness/clean-code');
	if (create) {
		await validateCacheAncestor(root, directory);
		await mkdir(directory, { recursive: true, mode: 0o700 });
	}
	const [base, actual] = await Promise.all([realpath(root), realpath(directory)]);
	const path = relative(base, actual);
	if (path.startsWith('..') || isAbsolute(path)) throw new Error('Cache is outside project');
	return actual;
}

async function validateCacheAncestor(root: string, directory: string): Promise<void> {
	const base = await realpath(root);
	let ancestor = directory;
	let actual: string | undefined;
	while (!actual) {
		try {
			actual = await realpath(ancestor);
		} catch {
			ancestor = dirname(ancestor);
		}
	}
	const path = relative(base, actual);
	if (path.startsWith('..') || isAbsolute(path))
		throw new Error('Cache ancestor is outside project');
}
