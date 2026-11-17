import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { githubCommitFacts } from '../../src/utils/git-source-history/create-git-hub-source/githubCommitFacts';

type Client = Parameters<typeof githubCommitFacts>[0];
type Case = { name: string; input: unknown } & ({ output: unknown } | { error: unknown });

const UNIT = 'collaboration.function.github-commit-facts';
const single = '9f2c4e7a1b3d586e0c9a2f47d1e8b5a03c6d9e21';
const merge = 'd41e7b92c05f8a36e1d4b7c9a02f5e8d3c6b1a47';
const parentA = '0a4b8c2d6e1f7a3b9c5d0e2f8a1b4c7d6e9f0a23';
const parentB = '6c3e0a8f2d91b47e5c0a9d3f16b8e2d4a7c51f09';
const treeA = '5b8e1f0c4a7d2e9b6f3c1a8d0e5b7f2c9a4d6e13';
const treeM = 'e72a0c9d4b18f63e5a0d7c2b9f41e8a6d3c05b92';

const singleFacts = {
	commit: single,
	tree: treeA,
	parents: [parentA],
	subject: 'Add commit facts reader',
	author: 'Mira Chen',
	committedAt: '2026-11-12T09:30:00Z'
};
const mergeFacts = {
	commit: merge,
	tree: treeM,
	parents: [single, parentB],
	subject: "Merge branch 'review-links' into main",
	author: 'Sam Okafor',
	committedAt: '2026-11-13T17:05:42Z'
};

function githubCommit(input: {
	sha: string;
	tree: string;
	parents: string[];
	message: string;
	author: string;
	date: string;
}) {
	return {
		sha: input.sha,
		tree: { sha: input.tree },
		parents: input.parents.map((parent) => ({ sha: parent })),
		message: input.message,
		author: { name: input.author, date: input.date },
		committer: { name: input.author, date: input.date }
	};
}

const singleJson = githubCommit({
	sha: single,
	tree: treeA,
	parents: [parentA],
	message: 'Add commit facts reader\n\nReads the commit as GitHub states it.',
	author: 'Mira Chen',
	date: '2026-11-12T09:30:00Z'
});
const mergeJson = githubCommit({
	sha: merge,
	tree: treeM,
	parents: [single, parentB],
	message: "Merge branch 'review-links'\n  into main\n\nBrings in the review links work.",
	author: 'Sam Okafor',
	date: '2026-11-13T17:05:42Z'
});

/** A fake transport: check() records a call and may refuse; request() returns the given reply. */
function fakeClient(reply: { status: number; data?: unknown }, denied = false) {
	const calls: string[] = [];
	const client = {
		check: () => {
			calls.push('check');
			if (denied) throw Object.assign(new Error('denied'), { code: 'repository-denied' });
			return Promise.resolve();
		},
		request: (path: string) => {
			calls.push(path);
			return Promise.resolve(reply);
		}
	};
	return { client: client as unknown as Client, calls };
}

async function failureCode(run: () => Promise<unknown>): Promise<string> {
	try {
		await run();
	} catch (error) {
		return String((error as { code?: unknown }).code);
	}
	return 'no-error';
}

function record(state: string, cases: Case[]): void {
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'githubCommitFacts',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Reads the facts of a single-parent and a merge commit', async () => {
	const first = fakeClient({ status: 200, data: singleJson });
	const second = fakeClient({ status: 200, data: mergeJson });
	const one = await githubCommitFacts(first.client, single);
	const two = await githubCommitFacts(second.client, merge);

	expect(one).toEqual(singleFacts);
	expect(two).toEqual(mergeFacts);
	expect(first.calls).toEqual(['check', `/git/commits/${single}`]);
	record('reads-the-facts-of-a-single-parent-and-a-merge-commit', [
		{ name: 'read a commit with one parent', input: { commit: single }, output: one },
		{ name: 'read a merge commit with parents in order', input: { commit: merge }, output: two }
	]);
});

test('Returns null when GitHub answers 404 for the commit', async () => {
	const fake = fakeClient({ status: 404 });
	const result = await githubCommitFacts(fake.client, single);

	expect(result).toBeNull();
	record('returns-null-when-github-answers-404-for-the-commit', [
		{ name: 'commit GitHub does not hold', input: { commit: single }, output: result }
	]);
});

test('Refuses a commit whose returned sha differs', async () => {
	const fake = fakeClient({ status: 200, data: singleJson });
	const code = await failureCode(() => githubCommitFacts(fake.client, parentA));

	expect(code).toBe('commit-mismatch');
	record('refuses-a-commit-whose-returned-sha-differs', [
		{ name: 'GitHub returns another commit than asked', input: { commit: parentA }, error: { code } }
	]);
});

test('Rejects a malformed commit id before any request', async () => {
	const fake = fakeClient({ status: 200, data: singleJson });
	const short = await failureCode(() => githubCommitFacts(fake.client, '9f2c4e7a'));
	const upper = await failureCode(() => githubCommitFacts(fake.client, single.toUpperCase()));

	expect(short).toBe('invalid-input');
	expect(upper).toBe('invalid-input');
	expect(fake.calls).toEqual([]);
	record('rejects-a-malformed-commit-id-before-any-request', [
		{ name: 'abbreviated commit id', input: { commit: '9f2c4e7a' }, error: { code: short } },
		{ name: 'uppercase commit id', input: { commit: single.toUpperCase() }, error: { code: upper } }
	]);
});

test('Propagates a repository-denied error from the access check', async () => {
	const fake = fakeClient({ status: 200, data: singleJson }, true);
	const code = await failureCode(() => githubCommitFacts(fake.client, single));

	expect(code).toBe('repository-denied');
	expect(fake.calls).toEqual(['check']);
	record('propagates-a-repository-denied-error-from-the-access-check', [
		{ name: 'access check refuses the repository', input: { commit: single }, error: { code } }
	]);
});
