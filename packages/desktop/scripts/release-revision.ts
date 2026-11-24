// @harness-uid u_release_revision
import { execFileSync } from 'node:child_process';
import { MacPackageError } from './package-mac.types';

/**
 * The exact commit a release is cut from. A release refuses a tree with tracked changes, so the
 * embedded revision names the source that was built.
 */
export function releaseRevision(cwd: string = process.cwd()): string {
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
	let revision: string;
	let tracked: string;
	try {
		revision = git('rev-parse', '--verify', 'HEAD').trim();
		tracked = git('status', '--porcelain', '--untracked-files=no').trim();
	} catch {
		throw new MacPackageError('Release packaging needs a git commit.');
	}
	if (!isRevision(revision)) throw new MacPackageError('Release packaging needs a git commit.');
	if (tracked !== '')
		throw new MacPackageError(
			'Release packaging needs a clean tracked worktree so the embedded revision is exact.'
		);
	return revision;
}

/** Release artifacts must state the full 40-character commit they were built from. */
export function isRevision(value: unknown): value is string {
	return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}
