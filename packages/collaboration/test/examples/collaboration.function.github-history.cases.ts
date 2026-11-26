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
export const repository = {
	id: 202,
	owner: 'acme',
	name: 'pilot',
	private: true,
	installationId: 7
};
export const tip = '9d2c6f0a4e8b1375c9a2d4f6e8b0c1a3d5f7e9b2';
export const older = '3f9c1a7e5b2d84f06c1e9a3b7d5f2e8c4a6b0d17';
export const rootCommit = 'e70a5b3c9d1f4286a0e3c7b5d9f1a2e4c6b8d0f3';
const known = [tip, older, rootCommit];
export const treeOf = (commit: string) => commit.slice(0, 8).repeat(5);
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
export function fakeGitHub(replies: Record<string, { status?: number; body?: unknown }>) {
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
export const verify = (github: ReturnType<typeof fakeGitHub>, commit: string, tipCommit: string) =>
	ensureAncestry(github.transport(), commit, tipCommit).then(() => 'resolved');
/** One real call with its scripted GitHub replies: what came back, or the code it was refused with. */
export async function call<Input>(
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
export const recorded = (symbol: string, state: string) => ({
	...meta,
	symbol,
	state,
	file: `${state}.json`
});

test('ensureAncestry accepts the tip itself without a request', async () => {
	const result = await call('commit equal to the tip', { commit: tip, tip }, {}, (github) =>
		verify(github, tip, tip)
	);
	const state = 'ensureancestry-accepts-the-tip-itself-without-a-request';
	recordExampleCases(recorded('ensureAncestry', state), [result]);
	expect(result.output).toEqual({ value: 'resolved', requests: [] });
});
