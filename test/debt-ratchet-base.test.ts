import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { ratchetBaseVariable, selectRatchetBase } from '../scripts/debt-ratchet-base';
import type { GitRead } from '../scripts/debt-ratchet-base';
import { withTempRepo } from './support/temporary';

/** A git double: `refs` resolve to commits, `bases` answers merge-base by "tip head". */
function fakeGit(refs: Record<string, string>, bases: Record<string, string> = {}): GitRead {
	return (args) => {
		if (args[0] === 'rev-parse') {
			const commit = refs[String(args.at(-1)).replace('^{commit}', '')];
			if (!commit) throw new Error('unknown revision');
			return `${commit}\n`;
		}
		if (args[0] === 'merge-base') {
			const shared = bases[`${args[1]} ${args[2]}`];
			if (!shared) throw new Error('no merge base');
			return `${shared}\n`;
		}
		throw new Error(`unexpected git ${args.join(' ')}`);
	};
}

test('a branch is compared from its merge-base with origin/main, not from HEAD^', () => {
	const git = fakeGit(
		{ HEAD: 'head', 'HEAD^': 'parent', 'origin/main': 'remote', main: 'local' },
		{ 'remote head': 'fork', 'local head': 'other' }
	);
	expect(selectRatchetBase(git, {})).toEqual({
		commit: 'fork',
		message: 'Ratchet base: merge-base of HEAD and origin/main.'
	});
});

test('a checkout without origin/main uses local main, and a pull request uses its base', () => {
	const localOnly = fakeGit({ HEAD: 'head', main: 'local' }, { 'local head': 'fork' });
	expect(selectRatchetBase(localOnly, {})).toEqual({
		commit: 'fork',
		message: 'origin/main does not exist. Ratchet base: merge-base of HEAD and main.'
	});
	const pullRequest = fakeGit(
		{ HEAD: 'head', 'origin/release': 'release', 'origin/main': 'remote' },
		{ 'release head': 'release-fork', 'remote head': 'main-fork' }
	);
	expect(selectRatchetBase(pullRequest, { GITHUB_BASE_REF: 'release' }).commit).toBe(
		'release-fork'
	);
});

test('no protected branch falls back to HEAD^ with a message instead of crashing', () => {
	const result = selectRatchetBase(fakeGit({ HEAD: 'head', 'HEAD^': 'parent' }), {});
	expect(result.commit).toBe('parent');
	expect(result.message).toContain('origin/main does not exist. main does not exist.');
	expect(result.message).toContain('only the last commit is compared');
	expect(result.message).toContain(ratchetBaseVariable);
	const rootOnly = selectRatchetBase(fakeGit({ HEAD: 'head' }), {});
	expect(rootOnly.commit).toBeNull();
	expect(rootOnly.message).toContain('HEAD has no parent');
	expect(selectRatchetBase(fakeGit({}), {}).commit).toBeNull();
});

test('HEAD on the protected branch compares its first parent and never a stale local main', () => {
	const git = fakeGit(
		{ HEAD: 'head', 'HEAD^': 'parent', 'origin/main': 'head', main: 'stale' },
		{ 'head head': 'head', 'stale head': 'stale' }
	);
	const result = selectRatchetBase(git, {});
	expect(result.commit).toBe('parent');
	expect(result.message).toContain('HEAD is already part of origin/main.');
});

test('the override wins, an all-zero or unknown override is passed over with a note', () => {
	const refs = { HEAD: 'head', 'HEAD^': 'parent', 'origin/main': 'remote', before: 'before' };
	const bases = { 'remote head': 'fork', 'before head': 'before' };
	expect(selectRatchetBase(fakeGit(refs, bases), { [ratchetBaseVariable]: 'before' })).toEqual({
		commit: 'before',
		message: `Ratchet base: ${ratchetBaseVariable}=before.`
	});
	const zero = selectRatchetBase(fakeGit(refs, bases), { [ratchetBaseVariable]: '0'.repeat(40) });
	expect(zero).toEqual({
		commit: 'fork',
		message: 'Ratchet base: merge-base of HEAD and origin/main.'
	});
	const unknown = selectRatchetBase(fakeGit(refs, bases), { [ratchetBaseVariable]: 'gone' });
	expect(unknown.commit).toBe('fork');
	expect(unknown.message).toContain(`${ratchetBaseVariable}=gone is not a commit`);
	// A rewritten push: the previous tip is no ancestor, so its fork point is the base.
	const rewritten = fakeGit(refs, { ...bases, 'before head': 'older' });
	expect(selectRatchetBase(rewritten, { [ratchetBaseVariable]: 'before' }).commit).toBe('older');
});

test('real git: a two-commit branch resolves to the fork point with and without main', async () => {
	await withTempRepo(async ({ root, git }) => {
		const read: GitRead = (args) =>
			execFileSync('git', [...args], {
				cwd: root,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore']
			});
		const commit = (name: string) => {
			writeFileSync(join(root, name), name);
			git('add', name);
			git('commit', '-q', '-m', name);
			return git('rev-parse', 'HEAD');
		};
		const root0 = commit('root');
		expect(selectRatchetBase(read, {})).toMatchObject({ commit: null });
		const fork = commit('fork');
		expect(selectRatchetBase(read, {}).commit).toBe(root0);
		git('checkout', '-q', '-b', 'feature');
		commit('first');
		const second = commit('second');
		expect(selectRatchetBase(read, {}).commit).toBe(fork);
		expect(selectRatchetBase(read, { [ratchetBaseVariable]: 'HEAD^' }).commit).not.toBe(fork);
		git('checkout', '-q', '--detach', second);
		git('branch', '-q', '-D', 'main');
		const detached = selectRatchetBase(read, {});
		expect(detached.commit).toBe(git('rev-parse', 'HEAD^'));
		expect(detached.message).toContain('main does not exist.');
	});
});
