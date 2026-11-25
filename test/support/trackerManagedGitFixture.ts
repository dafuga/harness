import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import type {
	TrackerHostLaunchPort,
	TrackerHostStartRequest
} from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type { TemporaryRepo } from './temporary.types';

export function seedManagedFixtureOrigin({ root, git }: TemporaryRepo): string {
	const origin = join(root, 'origin.git');
	git('init', '--quiet', '--bare', '--initial-branch=release', origin);
	git('remote', 'add', 'origin', origin);
	git('commit', '--allow-empty', '-m', 'Fixture source');
	git('push', '--quiet', 'origin', 'HEAD:refs/heads/release');
	return origin;
}

export function advanceFixtureOrigin(repo: TemporaryRepo) {
	const { root, git } = repo;
	const remote = seedManagedFixtureOrigin(repo);
	const initial = git('rev-parse', 'HEAD');
	git('update-ref', 'refs/remotes/origin/main', initial);
	git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
	const origin = git(
		'--git-dir=' + remote,
		'commit-tree',
		initial + '^{tree}',
		'-p',
		initial,
		'-m',
		'Remote-only change'
	);
	git('--git-dir=' + remote, 'update-ref', 'refs/heads/release', origin);
	git('switch', '--quiet', '-c', 'local-work');
	git('commit', '--allow-empty', '-m', 'Unpublished local change');
	writeFileSync(join(root, '.git', 'FETCH_HEAD'), 'existing fetch record\n');
	return { origin, local: git('rev-parse', 'HEAD') };
}

export function verifyManagedWorktreeRevisions(
	{ root, git }: TemporaryRepo,
	worktrees: string[],
	revision: ReturnType<typeof advanceFixtureOrigin>
) {
	expect(worktrees.map((path) => git('-C', path, 'rev-parse', 'HEAD'))).toEqual(
		worktrees.map(() => revision.origin)
	);
	for (const path of worktrees)
		expect(git('-C', path, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('HEAD');
	expect(git('rev-parse', 'HEAD')).toBe(revision.local);
	expect(git('symbolic-ref', '--short', 'HEAD')).toBe('local-work');
	expect(readFileSync(join(root, '.git', 'FETCH_HEAD'), 'utf8')).toBe('existing fetch record\n');
}

export async function verifyUnavailableManagedOrigin(
	{ root, git }: TemporaryRepo,
	launcher: TrackerHostLaunchPort,
	input: TrackerHostStartRequest,
	signal: AbortSignal
) {
	git('remote', 'set-url', 'origin', join(root, 'unreachable.git'));
	const unavailable = { ...input, runId: 5, key: JSON.stringify([input.itemId, 'offline', 1]) };
	expect(await launcher.start(unavailable, signal)).toMatchObject({ status: 'rejected' });
	expect(await launcher.inspect({ node: input.node, keys: [unavailable.key] }, signal)).toEqual([]);
}
