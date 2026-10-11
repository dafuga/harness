import { expect, test } from 'vitest';
import { consoleRoute, consoleRoutePath } from '../../src/utils/consoleRoute';
import { sourceBranches, type ListedRef } from '../../src/utils/sourceBranches';

const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((letter) => letter.repeat(40));
const local = (name: string, head: string): ListedRef => ({ ref: `refs/heads/${name}`, head });
const remote = (name: string, head: string): ListedRef => ({ ref: `refs/remotes/${name}`, head });
const named = (refs: ListedRef[], remotes = ['origin']) =>
	sourceBranches(refs, remotes).map((branch) => [branch.name, branch.head]);

test('a branch a clone has only from its remote keeps its plain name and real tip', () => {
	// A fresh clone: one local branch, the others remote-tracking, and the remote's HEAD.
	const refs = [
		local('feat/work', a),
		remote('origin/feat/work', a),
		remote('origin/main', b),
		remote('origin/release/1.0', c),
		{ ref: 'refs/remotes/origin/HEAD', head: b, symbolic: 'refs/remotes/origin/main' }
	];
	expect(named(refs)).toEqual([
		['feat/work', a],
		['main', b],
		['release/1.0', c]
	]);
});

test('a remote tip that differs from the local branch of that name is listed beside it, never instead', () => {
	// The local branch is behind what was fetched: it stays where it is.
	expect(named([local('main', a), remote('origin/main', b)])).toEqual([
		['main', a],
		['origin:main', b]
	]);
	// A local branch may be called origin/main; a colon cannot occur in the name of a branch.
	const collision = [local('origin/main', c), local('main', a), remote('origin/main', b)];
	expect(named(collision)).toEqual([
		['main', a],
		['origin/main', c],
		['origin:main', b]
	]);
});

test('remotes that disagree about a branch are each named, and one that agrees is not repeated', () => {
	const remotes = ['origin', 'team/mirror'];
	const agree = [remote('origin/topic', a), remote('team/mirror/topic', a)];
	expect(named(agree, remotes)).toEqual([['topic', a]]);
	const differ = [remote('origin/topic', a), remote('team/mirror/topic', b)];
	expect(named(differ, remotes)).toEqual([
		['origin:topic', a],
		['team/mirror:topic', b]
	]);
	// With a local branch at one of the tips, only the other tip is new.
	expect(named([local('topic', a), ...differ], remotes)).toEqual([
		['team/mirror:topic', b],
		['topic', a]
	]);
	// A remote that is no longer configured is read up to its first slash.
	expect(named([remote('gone/topic', d)], [])).toEqual([['topic', d]]);
});

test('evidence, notes, archived source, tags and a remote HEAD are never branches of code', () => {
	const refs: ListedRef[] = [
		local('main', a),
		local('harness-evidence', b),
		remote('origin/harness-evidence', b),
		{ ref: 'refs/remotes/origin/HEAD', head: a, symbolic: 'refs/remotes/origin/main' },
		{ ref: 'refs/notes/harness', head: c },
		{ ref: `refs/harness/source/${d}`, head: d },
		{ ref: 'refs/harness/remotes/origin/evidence', head: b },
		{ ref: 'refs/tags/v1', head: c }
	];
	expect(named(refs)).toEqual([['main', a]]);
});

test('a page of a remote tip has a path of its own that leads back to the same branch', () => {
	const route = { branch: 'origin:feature/kept#1', commit: a, view: 'history' as const };
	const path = consoleRoutePath(route);
	expect(path).toBe(`/branch/origin%3Afeature/kept%231/commit/${a}/history`);
	expect(consoleRoute(path)).toMatchObject(route);
	expect(
		consoleRoute(consoleRoutePath({ ...route, branch: 'origin/feature/kept#1' }))?.branch
	).toBe('origin/feature/kept#1');
});
