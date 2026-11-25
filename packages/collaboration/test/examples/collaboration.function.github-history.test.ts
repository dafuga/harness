import { test } from 'vitest';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import {
	tip,
	older,
	rootCommit,
	call,
	verify,
	fakeGitHub,
	repository,
	recorded,
	treeOf
} from './collaboration.function.github-history.cases';

const other = 'b41e8d02f7a9c3516e2d0b8f4a7c9e13d5f6a208';
const record = (sha: string, message: string, author: string | null, committer: string) => ({
	sha,
	commit: { message, author: author && { date: author }, committer: { date: committer } }
});
const tipRecord = record(tip, 'Tighten the capability note', '2026-11-14', '2026-11-15');
const olderRecord = record(older, 'Add the history index', null, '2026-11-13');
const rootRecord = record(rootCommit, 'Start the docs', '2026-11-01', '2026-11-01');
const answer = (status: string, base: string) => ({
	body: { status, merge_base_commit: { sha: base } }
});
/** GitHub's answer to comparing commit with the tip, and what ensureAncestry makes of it. */
const comparison = (name: string, commit: string, reply: { status?: number; body?: unknown }) =>
	call(name, { commit, tip }, { [`/compare/${commit}...${tip}`]: reply }, (github) =>
		verify(github, commit, tip)
	);
const commitsOf = (
	name: string,
	input: { branch: string; commit?: string },
	replies: Parameters<typeof fakeGitHub>[0]
) => call(name, input, replies, (github) => github.history().commits(repository, input));
const changedOf = (name: string, commit: string, parents: Array<{ sha: string }>) =>
	call(name, { commit }, { [`/git/commits/${commit}`]: { body: { parents } } }, (github) =>
		github.history().changed(repository, commit)
	);
/** A lookup of ref with GitHub's answers; the repository is confirmed unless the answers say not. */
const lookup = (name: string, ref: string, answers: Parameters<typeof fakeGitHub>[0]) =>
	call(name, { ref }, { '/': { body: { id: 202, private: true } }, ...answers }, (github) =>
		github.history().optionalRef(repository, ref)
	);

test('ensureAncestry accepts only commits that the tip contains', async () => {
	const cases = [
		await comparison('ahead, so the commit is the merge base', older, answer('ahead', older)),
		await comparison('identical, with the commit as base', older, answer('identical', older)),
		await comparison('behind, so the merge base is the tip', older, answer('behind', tip)),
		await comparison('ahead, but from another merge base', older, answer('ahead', other))
	];
	const state = 'ensureancestry-accepts-only-commits-that-the-tip-contains';
	recordExampleCases(recorded('ensureAncestry', state), cases);
	expect(cases.map((item) => item.output?.value ?? item.error?.code)).toEqual([
		'resolved',
		'resolved',
		'unreachable-anchor',
		'unreachable-anchor'
	]);
});

test('ensureAncestry refuses unsafe paths and unusable replies', async () => {
	const cases = [
		await comparison('404 for the comparison', older, { status: 404 }),
		await comparison('no merge base commit in the reply', older, { body: { status: 'ahead' } }),
		await comparison('status is not a comparison status', older, answer('sideways', older)),
		await comparison('a .. segment, refused before any request', '../other', {})
	];
	const state = 'ensureancestry-refuses-unsafe-paths-and-unusable-replies';
	recordExampleCases(recorded('ensureAncestry', state), cases);
	expect(cases.map((item) => item.error?.code)).toEqual([
		'github-unavailable',
		'invalid-input',
		'invalid-input',
		'invalid-path'
	]);
	expect(cases[3].error?.requests).toEqual([]);
});

test('githubHistory commits lists history from a branch tip', async () => {
	const tipPage = {
		[`/commits?sha=${tip}&per_page=100&page=1`]: { body: [tipRecord, olderRecord] }
	};
	const olderPage = {
		[`/compare/${older}...${tip}`]: answer('ahead', older),
		[`/commits?sha=${older}&per_page=100&page=1`]: { body: [olderRecord, rootRecord] }
	};
	const cases = [
		await commitsOf('the main tip lists its commits', { branch: 'main' }, tipPage),
		await commitsOf('an older commit of main', { branch: 'main', commit: older }, olderPage),
		await commitsOf('a branch the source cannot resolve', { branch: 'gone' }, {}),
		await commitsOf('a branch name with .. is invalid', { branch: 'main..dev' }, {})
	];
	const state = 'githubhistory-commits-lists-history-from-a-branch-tip';
	recordExampleCases(recorded('commits', state), cases);
	expect(cases[0].output?.value).toEqual([
		{ hash: tip, subject: 'Tighten the capability note', authoredAt: '2026-11-14' },
		{ hash: older, subject: 'Add the history index', authoredAt: '2026-11-13' }
	]);
	expect(cases[1].output?.value).toEqual([
		{ hash: older, subject: 'Add the history index', authoredAt: '2026-11-13' },
		{ hash: rootCommit, subject: 'Start the docs', authoredAt: '2026-11-01' }
	]);
	expect(cases.slice(2).map((item) => item.error?.code)).toEqual(['unknown-ref', 'invalid-input']);
});

test('githubHistory changed lists paths against the first parent', async () => {
	const cases = [
		await changedOf('a commit adds, removes and re-modes files', tip, [{ sha: older }]),
		await changedOf('a root commit lists all its non-tree paths', rootCommit, []),
		await changedOf('a name that is not a commit hash', 'HEAD', [])
	];
	const state = 'githubhistory-changed-lists-paths-against-the-first-parent';
	recordExampleCases(recorded('changed', state), cases);
	expect(cases[0].output?.value).toEqual(['a.md', 'run.sh', 'src/new.ts', 'src/old.ts']);
	expect(cases[1].output?.value).toEqual(['a.md', 'docs/guide.md']);
	expect(cases[2].error?.code).toBe('invalid-input');
});

test('githubHistory optionalRef resolves a ref or returns null', async () => {
	const cases = [
		await lookup('an existing ref resolves through the source', 'refs/heads/main', {
			'/git/ref/heads/main': { body: { ref: 'refs/heads/main', object: { sha: tip } } }
		}),
		await lookup('a missing branch ref is null', 'refs/heads/gone', {
			'/git/ref/heads/gone': { status: 404 }
		}),
		await lookup('a ref outside heads, notes and tags', 'refs/remotes/origin/main', {}),
		await lookup('a repository id GitHub does not confirm', 'refs/heads/main', {
			'/': { body: { id: 999, private: true } }
		})
	];
	const state = 'githubhistory-optionalref-resolves-a-ref-or-returns-null';
	recordExampleCases(recorded('optionalRef', state), cases);
	expect(cases[0].output?.value).toEqual({ commit: tip, tree: treeOf(tip) });
	expect(cases[0].output?.requests.map((r) => r.path)).toEqual(['/', '/git/ref/heads/main']);
	expect(cases[1].output?.value).toBeNull();
	expect(cases.slice(2).map((item) => item.error?.code)).toEqual([
		'invalid-ref',
		'repository-denied'
	]);
});
