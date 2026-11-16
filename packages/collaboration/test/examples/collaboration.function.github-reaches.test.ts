import { test } from 'vitest';
import { githubReaches } from '../../src/utils/git-source-history/create-git-hub-source/githubReaches';
import type { GitHubTransport } from '../../src/utils/git-source-history/githubTransport.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

type TransportCall = { method: 'check' } | { method: 'request'; path: string; statuses: number[] };
type ReachabilityExample = {
	name: string;
	input: { tip: string; commit: string };
	comparison?: { status: number; data: unknown | null };
};

function recordingTransport(response: { status: number; data: unknown | null }) {
	const calls: TransportCall[] = [];
	const client: GitHubTransport = {
		async check() {
			calls.push({ method: 'check' });
		},
		async request(path, options) {
			calls.push({ method: 'request', path, statuses: [...(options?.statuses ?? [])] });
			return { ...response, hasNext: false };
		}
	};
	return { client, calls };
}

async function runExample(example: ReachabilityExample) {
	const response = example.comparison ?? { status: 200, data: null };
	const { client, calls } = recordingTransport(response);
	const reachable = await githubReaches(client, example.input);
	return {
		name: example.name,
		input: {
			...example.input,
			transport: example.comparison ? { comparison: example.comparison } : 'unused'
		},
		output: { reachable, calls }
	};
}

test('Checks whether a candidate commit is reachable from the tip', async () => {
	const candidate = '0123456789abcdef0123456789abcdef01234567';
	const tip = '89abcdef0123456789abcdef0123456789abcdef';
	const otherBase = 'fedcba9876543210fedcba9876543210fedcba98';
	const examples: ReachabilityExample[] = [
		{
			name: 'equal SHAs are reachable without GitHub access',
			input: { tip: candidate, commit: candidate }
		},
		{
			name: 'an ahead comparison reaches its merge base',
			input: { tip, commit: candidate },
			comparison: { status: 200, data: { status: 'ahead', merge_base_commit: { sha: candidate } } }
		},
		{
			name: 'a diverged comparison does not reach the candidate',
			input: { tip, commit: candidate },
			comparison: {
				status: 200,
				data: { status: 'diverged', merge_base_commit: { sha: otherBase } }
			}
		},
		{
			name: 'a missing comparison is unreachable',
			input: { tip, commit: candidate },
			comparison: { status: 404, data: null }
		}
	];
	const results = await Promise.all(examples.map(runExample));
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-reaches',
			symbol: 'githubReaches',
			state: 'checks-whether-a-candidate-commit-is-reachable-from-the-tip',
			evidence: 'examples-cases',
			file: 'checks-whether-a-candidate-commit-is-reachable-from-the-tip.json'
		},
		results
	);

	expect(results.map(({ output }) => output.reachable)).toEqual([true, true, false, false]);
	expect(results[0]?.output.calls).toEqual([]);
	expect(results[1]?.output.calls).toEqual([
		{ method: 'check' },
		{ method: 'request', path: `/compare/${candidate}...${tip}`, statuses: [404] }
	]);
});
