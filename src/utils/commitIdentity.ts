import type { GitAdapter } from '../adapters/GitAdapter';

/**
 * The identity for commits Harness writes to evidence and notes. The repository's configured
 * identity is used; only where none exists does Harness name itself, so recording evidence
 * never depends on, or changes, anyone's Git configuration.
 */
export async function commitIdentity(git: GitAdapter): Promise<Record<string, string>> {
	const name = (await git.attempt(['config', 'user.name'])) ?? 'Harness';
	const email = (await git.attempt(['config', 'user.email'])) ?? 'harness@localhost';
	return {
		GIT_AUTHOR_NAME: name || 'Harness',
		GIT_AUTHOR_EMAIL: email || 'harness@localhost',
		GIT_COMMITTER_NAME: name || 'Harness',
		GIT_COMMITTER_EMAIL: email || 'harness@localhost'
	};
}
