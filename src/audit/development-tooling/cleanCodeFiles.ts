import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

export interface ReviewInputFile {
	path: string;
	contents: string;
	hash: string;
}

export function reviewHash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export async function readReviewInput(root: string, path: string): Promise<ReviewInputFile> {
	const absolutePath = join(root, path);
	const [rootPath, filePath, details] = await Promise.all([
		realpath(root),
		realpath(absolutePath),
		lstat(absolutePath)
	]);
	const localPath = relative(rootPath, filePath);
	if (
		localPath.startsWith('..') ||
		isAbsolute(localPath) ||
		details.isSymbolicLink() ||
		!details.isFile()
	)
		throw new Error('Review input is outside the project or is a symlink.');
	if (details.size > 1024 * 1024) throw new Error('Review input exceeds the supported size.');
	const contents = await readFile(absolutePath, 'utf8');
	return { path, contents, hash: reviewHash(contents) };
}

export async function reviewInputsCurrent(
	root: string,
	inputs: ReviewInputFile[]
): Promise<boolean> {
	try {
		for (const input of inputs) {
			if ((await readReviewInput(root, input.path)).hash !== input.hash) return false;
		}
		return true;
	} catch {
		return false;
	}
}
