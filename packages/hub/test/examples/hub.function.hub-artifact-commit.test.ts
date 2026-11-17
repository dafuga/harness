import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubArtifactCommit } from '../../src/routes/api/[...path]/hub-projection-service/hubArtifactCommit';

type Context = Parameters<typeof hubArtifactCommit>[0];
type History = { complete: boolean; commits: Array<{ hash: string }> };
type Outcome = History | Error;

const artifactPath =
	'packages/hub/src/routes/api/[...path]/hub-projection-service/hubArtifactCommit.ts';
const introHash = '4f3c2a1b0e9d8c7b6a5f4e3d2c1b0a9876543210';
const otherHash = '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';

function requestFor() {
	return {
		repository: 'fixture-repository',
		query: { commit: 'fixture-head', paths: [artifactPath], page: 1, perPage: 2 }
	};
}

function contextReturning(outcome: Outcome) {
	const requests: unknown[] = [];
	const historyPage = async (repository: unknown, query: unknown) => {
		requests.push({ repository, query });
		if (outcome instanceof Error) throw outcome;
		return outcome;
	};
	const context = {
		source: { historyPage },
		repository: 'fixture-repository',
		commit: 'fixture-head'
	} as unknown as Context;
	return { context, requests };
}

test('Returns the introduction hash for one complete commit', async () => {
	const history = { complete: true, commits: [{ hash: introHash }] };
	const { context, requests } = contextReturning(history);
	const result = await hubArtifactCommit(context, artifactPath);
	expect(result).toBe(introHash);
	expect(requests).toEqual([requestFor()]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-artifact-commit',
			symbol: 'hubArtifactCommit',
			state: 'returns-the-introduction-hash-for-one-complete-commit',
			evidence: 'examples-cases',
			file: 'returns-the-introduction-hash-for-one-complete-commit.json'
		},
		[{ name: 'history has one complete commit', input: { path: artifactPath, history }, output: introHash }]
	);
});

test('Returns null for incomplete or rewritten history', async () => {
	const gaps: Array<{ name: string; history: History }> = [
		{ name: 'incomplete history with one commit', history: { complete: false, commits: [{ hash: introHash }] } },
		{
			name: 'complete history with two commits',
			history: { complete: true, commits: [{ hash: introHash }, { hash: otherHash }] }
		},
		{ name: 'complete history with no commits', history: { complete: true, commits: [] } }
	];
	const results = await Promise.all(
		gaps.map((gap) => hubArtifactCommit(contextReturning(gap.history).context, artifactPath))
	);
	expect(results).toEqual([null, null, null]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-artifact-commit',
			symbol: 'hubArtifactCommit',
			state: 'returns-null-for-incomplete-or-rewritten-history',
			evidence: 'examples-cases',
			file: 'returns-null-for-incomplete-or-rewritten-history.json'
		},
		gaps.map((gap, index) => ({
			name: gap.name,
			input: { path: artifactPath, history: gap.history },
			output: results[index]
		}))
	);
});

test('Returns null when the source lacks history support', async () => {
	const context = {
		source: {},
		repository: 'fixture-repository',
		commit: 'fixture-head'
	} as unknown as Context;
	const result = await hubArtifactCommit(context, artifactPath);
	expect(result).toBeNull();
	recordExampleCases(
		{
			unitId: 'hub.function.hub-artifact-commit',
			symbol: 'hubArtifactCommit',
			state: 'returns-null-when-the-source-lacks-history-support',
			evidence: 'examples-cases',
			file: 'returns-null-when-the-source-lacks-history-support.json'
		},
		[{ name: 'source has no historyPage', input: { path: artifactPath }, output: null }]
	);
});

test('Rejects when the source history request fails', async () => {
	const { context } = contextReturning(new Error('fixture history unavailable'));
	await expect(hubArtifactCommit(context, artifactPath)).rejects.toThrow(
		'fixture history unavailable'
	);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-artifact-commit',
			symbol: 'hubArtifactCommit',
			state: 'rejects-when-the-source-history-request-fails',
			evidence: 'examples-cases',
			file: 'rejects-when-the-source-history-request-fails.json'
		},
		[
			{
				name: 'historyPage rejects with an error',
				input: { path: artifactPath },
				error: 'fixture history unavailable'
			}
		]
	);
});
