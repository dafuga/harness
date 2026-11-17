import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { validateGitHubAnchor } from '../../src/utils/git-source-history/create-git-hub-source/validateGitHubAnchor';

const state = 'accepts-a-reachable-discussion-anchor';
const commit = '7d2e4f1a9c0b38e65d4a1f7c2b9e08d3a6f5c4b1';
const repository = {
	id: 712045933,
	owner: 'example-org',
	name: 'design-system',
	private: true,
	installationId: 48215367
};

test('Accepts a reachable discussion anchor', async () => {
	const calls: string[] = [];
	const deps = {
		adapter: {
			resolve: async (_repository: unknown, ref: string) => {
				calls.push(`resolve:${ref}`);
				return { commit };
			},
			tree: async () => [],
			read: async () => new Uint8Array(),
			validateAnchor: async () => {
				calls.push('validateAnchor');
			}
		},
		client: {
			request: async () => {
				calls.push('request');
				throw new Error('same-commit anchors need no ancestry request');
			}
		}
	} as unknown as Parameters<typeof validateGitHubAnchor>[0];
	const input = {
		branch: 'main',
		commit,
		entityId: 'harness.project.discussion',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	};

	await expect(validateGitHubAnchor(deps, repository, input)).resolves.toBeUndefined();
	expect(calls).toEqual(['resolve:refs/heads/main', `resolve:${commit}`]);
	recordExampleCases(
		{
			unitId: 'collaboration.function.validate-git-hub-anchor',
			symbol: 'validateGitHubAnchor',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'accept the discussion anchor at the branch tip without reading entity files',
				input: { repository, anchor: input },
				output: { result: 'resolved', adapterCalls: calls }
			}
		]
	);
});
