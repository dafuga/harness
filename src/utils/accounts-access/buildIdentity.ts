import { createHash } from 'node:crypto';
import { buildStamp, buildStampPattern, emptyBuildStamp } from '../development-tooling/buildStamp';

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

/**
 * The hash of one built file with its stamp slots emptied, and the stamps that filled them. A
 * slot counts as empty wherever it is, so stamping a build does not change its identity.
 */
export function builtFileHash(bytes: Buffer): { sha256: string; stamps: string[]; slots: number } {
	const hash = (content: Buffer) => createHash('sha256').update(content).digest('hex');
	if (!bytes.includes('harness-build:')) return { sha256: hash(bytes), stamps: [], slots: 0 };
	const text = bytes.toString('latin1');
	const found = text.match(buildStampPattern) ?? [];
	const emptied = Buffer.from(text.replace(buildStampPattern, emptyBuildStamp()), 'latin1');
	const stamps = found.flatMap((slot) => buildStamp(slot) ?? []);
	return { sha256: hash(emptied), stamps, slots: found.length };
}
