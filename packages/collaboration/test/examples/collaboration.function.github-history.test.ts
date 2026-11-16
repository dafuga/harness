import { test } from 'vitest';
import { ensureAncestry } from '../../src/utils/git-source-history/githubHistory';
import { githubHistory } from '../../src/utils/git-source-history/create-git-hub-source/githubHistory';
import { githubTransport } from '../../src/utils/git-source-history/githubTransport';
import type {
	SourceAdapter,
	SourceEntry
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real ensureAncestry and githubHistory, called as their callers call them, against a fake
 * GitHub that answers by request path and fails any other path, and a fake source adapter.
 * Each state is one test; its cases record what it was given, what came back and the requests.
 */
const repository = { id: 202, owner: 'acme', name: 'pilot', private: true, installationId: 7 };
const tip = '9d2c6f0a4e8b1375c9a2d4f6e8b0c1a3d5f7e9b2';
const older = '3f9c1a7e5b2d84f06c1e9a3b7d5f2e8c4a6b0d17';
const other = 'b41e8d02f7a9c3516e2d0b8f4a7c9e13d5f6a208';
const rootCommit = 'e70a5b3c9d1f4286a0e3c7b5d9f1a2e4c6b8d0f3';
const known = [tip, older, rootCommit];
const treeOf = (commit: string) => commit.slice(0, 8).repeat(5);
const blob = (path: string, sha: string) => ({ path, sha, type: 'blob' as const, mode: '100644' });
const dir = (path: string, sha: string) => ({ path, sha, type: 'tree' as const, mode: '040000' });
const entriesOf: Record<string, SourceEntry[]> = {
	[older]: [blob('a.md', 'a1'), dir('src', 's1'), blob('src/old.ts', 'o1'), blob('run.sh', 'r1')],
	[tip]: [
		blob('a.md', 'a2'),
		dir('src', 's2'),
		blob('src/new.ts', 'n1'),
		{ ...blob('run.sh', 'r1'), mode: '100755' }
	],
	[rootCommit]: [blob('a.md', 'a0'), dir('docs', 'd0'), blob('docs/guide.md', 'g0')]
};
const record = (sha: string, message: string, author: string | null, committer: string) => ({
	sha,
	commit: { message, author: author && { date: author }, committer: { date: committer } }
});
const tipRecord = record(tip, 'Tighten the capability note', '2026-11-14', '2026-11-15');
const olderRecord = record(older, 'Add the history index', null, '2026-11-13');
const rootRecord = record(rootCommit, 'Start the docs', '2026-11-01', '2026-11-01');
/** Branch refs and commit ids resolve to their commit and tree; any other ref is unknown. */
const source: SourceAdapter = {
	async resolve(_repository, ref) {
		const commit = ref === 'refs/heads/main' ? tip : ref;
		if (!known.includes(commit))
			throw Object.assign(new Error(`Unknown source ref ${ref}`), { code: 'unknown-ref' });
		return { commit, tree: treeOf(commit) };
	},
	tree: async (_repository, commit) => entriesOf[commit],
	read: () => Promise.reject(new Error('githubHistory reads no file bytes')),
	validateAnchor: () => Promise.reject(new Error('githubHistory validates no anchors'))
};
/** Answers by request path, relative to the repository, and fails any path it was not given. */
function fakeGitHub(replies: Record<string, { status?: number; body?: unknown }>) {
	const requests: Array<{ method: string; path: string }> = [];
	const respond = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		const path = `${url.pathname.replace('/repos/acme/pilot', '') || '/'}${url.search}`;
		requests.push({ method: init?.method ?? 'GET', path });
		const reply = replies[path];
		if (!reply) throw new Error(`Unexpected GitHub request ${path}`);
		return new Response(JSON.stringify(reply.body ?? null), { status: reply.status ?? 200 });
	};
	const granted = '{"installationId":7,"repositoryIds":[202],"permissions":{"contents":"read"}}';
	const token = async (scope: unknown) => {
		if (JSON.stringify(scope) !== granted) throw new Error('Token not granted');
		return 'example-token';
	};
	const options = { token, fetch: respond };
	return {
		requests,
		transport: () => githubTransport({ repository, ...options }, 'read'),
		history: () => githubHistory(source, options)
	};
}
const verify = (github: ReturnType<typeof fakeGitHub>, commit: string, tipCommit: string) =>
	ensureAncestry(github.transport(), commit, tipCommit).then(() => 'resolved');
/** One real call with its scripted GitHub replies: what came back, or the code it was refused with. */
async function call<Input>(
	name: string,
	input: Input,
	replies: Parameters<typeof fakeGitHub>[0],
	run: (github: ReturnType<typeof fakeGitHub>) => Promise<unknown>
) {
	const github = fakeGitHub(replies);
	const given = { args: input, github: replies };
	try {
		const value = await run(github);
		return { name, input: given, output: { value, requests: [...github.requests] } };
	} catch (error) {
		if (!(error instanceof Error && 'code' in error)) throw error;
		const refusal = { code: String(error.code), message: error.message };
		return { name, input: given, error: { ...refusal, requests: [...github.requests] } };
	}
}
const meta = { unitId: 'collaboration.function.github-history', evidence: 'examples-cases' };
const recorded = (symbol: string, state: string) => ({
	...meta,
	symbol,
	state,
	file: `${state}.json`
});
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

test('ensureAncestry accepts the tip itself without a request', async () => {
	const result = await call('commit equal to the tip', { commit: tip, tip }, {}, (github) =>
		verify(github, tip, tip)
	);
	const state = 'ensureancestry-accepts-the-tip-itself-without-a-request';
	recordExampleCases(recorded('ensureAncestry', state), [result]);
	expect(result.output).toEqual({ value: 'resolved', requests: [] });
});

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
