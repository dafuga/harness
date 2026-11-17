import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubSource, hubRead } from '../../src/utils/development-tooling/hubSource';
import type { HubSourceContext } from '../../src/utils/development-tooling/hubSource.types';

function sourceInput() {
	const calls: string[] = [];
	const adapter = {
		resolve: async (_repository: unknown, ref: string) => {
			calls.push(`resolve:${ref}`);
			return { commit: 'commit-42', tree: 'tree-42' };
		},
		optionalRef: async (_repository: unknown, ref: string) => {
			calls.push(`optional:${ref}`);
			return ref.includes('notes') ? { commit: 'notes-7' } : null;
		},
		tree: async (_repository: unknown, commit: string) => {
			calls.push(`tree:${commit}`);
			return [{ path: 'README.md', type: 'blob', mode: '100644', sha: 'blob-1' }];
		}
	};
	return {
		calls,
		input: {
			source: adapter as never,
			cache: {} as never,
			actor: { id: 'actor-3' } as never,
			project: {
				id: 'project-5',
				sourceRepository: { id: 'repo-8' },
				collaborationCommit: 'collab-9'
			} as never,
			ref: 'refs/heads/main'
		}
	};
}

test('hubSource pins the requested ref and records nullable revisions', async () => {
	const { calls, input } = sourceInput();
	const context = await hubSource(input);
	const summary = {
		commit: context.commit,
		paths: context.entries.map((entry) => entry.path),
		identity: context.identity
	};
	expect(summary).toMatchObject({
		commit: 'commit-42',
		paths: ['README.md'],
		identity: {
			principalId: 'actor-3',
			projectId: 'project-5',
			repositoryId: 'repo-8',
			requestedRef: 'refs/heads/main',
			sourceCommit: 'commit-42',
			sourceTree: 'tree-42',
			notesRevision: 'notes-7',
			evidenceRevision: null,
			collaborationRevision: 'collab-9',
			historyIndexRevision: null,
			artifactHash: null,
			profile: null
		}
	});
	recordExampleCases(
		{
			unitId: 'hub.function.hub-source',
			symbol: 'hubSource',
			state: 'hubsource-pins-the-requested-ref-and-records-nullable-revisi',
			evidence: 'examples-cases',
			file: 'hubsource-pins-the-requested-ref-and-records-nullable-revisi.json'
		},
		[
			{
				name: 'main ref resolves with notes, no evidence ref, and collaboration revision',
				input: { ref: 'refs/heads/main', repositoryId: 'repo-8' },
				output: { ...summary, calls }
			}
		]
	);
});

function missingBlobContext(): HubSourceContext {
	return {
		source: {} as never,
		repository: { id: 'repo-8' } as never,
		commit: 'commit-42',
		entries: [],
		identity: {} as never,
		cache: {} as never
	};
}

test('hubRead rejects a path without an eligible regular blob', async () => {
	const context = missingBlobContext();
	await expect(hubRead(context, 'packages/hub/src/utils/development-tooling/hubSource.ts')).rejects.toBeDefined();
	recordExampleCases(
		{
			unitId: 'hub.function.hub-source',
			symbol: 'hubRead',
			state: 'hubread-rejects-a-path-without-an-eligible-regular-blob',
			evidence: 'examples-cases',
			file: 'hubread-rejects-a-path-without-an-eligible-regular-blob.json'
		},
		[
			{
				name: 'requested source path is absent from the pinned tree',
				input: { path: 'packages/hub/src/utils/development-tooling/hubSource.ts', entries: [] },
				error: 'not-found'
			}
		]
	);
});
