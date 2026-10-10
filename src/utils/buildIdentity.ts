import { createHash } from 'node:crypto';

export interface BuiltFile {
	/** Path inside the build directory, with forward slashes. */
	path: string;
	sha256: string;
}

/**
 * The identity of a compiled build: one digest over the path and content hash of every file,
 * in path order. Two directories share an identity only when they hold the same files.
 */
export function buildIdentity(files: BuiltFile[]): string {
	const ordered = [...files].sort((left, right) => (left.path < right.path ? -1 : 1));
	const hash = createHash('sha256');
	for (const file of ordered) hash.update(`${file.sha256}  ${file.path}\n`);
	return hash.digest('hex');
}
