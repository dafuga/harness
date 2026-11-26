import { test } from 'vitest';
import { githubReaches } from '../../src/utils/git-source-history/create-git-hub-source/githubReaches';
import type { GitHubTransport } from '../../src/utils/git-source-history/githubTransport.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type {
	TransportCall,
	ReachabilityExample
} from './collaboration.function.github-reaches.test.types';

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

test('Throws ZodError when a SHA does not match its schema', async () => {
	const tip = '89abcdef0123456789abcdef0123456789abcdef';
	const { client } = recordingTransport({ status: 200, data: null });
	let thrown: unknown;
	try {
		await githubReaches(client, { tip, commit: 'not-a-sha' });
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toMatchObject({ name: 'CollaborationInputError' });
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-reaches',
			symbol: 'githubReaches',
			state: 'throws-zoderror-when-a-sha-does-not-match-its-schema',
			evidence: 'examples-cases',
			file: 'throws-zoderror-when-a-sha-does-not-match-its-schema.json'
		},
		[
			{
				name: 'invalid candidate SHA rejects before transport access',
				input: { tip, commit: 'not-a-sha' },
				error: {
					name: (thrown as { name: string }).name,
					message: (thrown as Error).message
				}
			}
		]
	);
});

test('Throws Error when the transport check rejects', async () => {
	const candidate = '0123456789abcdef0123456789abcdef01234567';
	const tip = '89abcdef0123456789abcdef0123456789abcdef';
	const failure = new Error('example transport failure');
	const client: GitHubTransport = {
		async check() {
			throw failure;
		},
		async request() {
			return { status: 200, data: null, hasNext: false };
		}
	};
	let thrown: unknown;
	try {
		await githubReaches(client, { tip, commit: candidate });
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBe(failure);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-reaches',
			symbol: 'githubReaches',
			state: 'throws-error-when-the-transport-check-rejects',
			evidence: 'examples-cases',
			file: 'throws-error-when-the-transport-check-rejects.json'
		},
		[
			{
				name: 'transport check rejection propagates',
				input: { tip, commit: candidate, transport: 'check rejects' },
				error: { name: failure.name, message: failure.message }
			}
		]
	);
});
