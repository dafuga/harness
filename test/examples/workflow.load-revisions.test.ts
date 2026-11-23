import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import {
	commitLoader,
	emptySide,
	openRange
} from '../../src/workflows/development-tooling/loadRevisions';

test('Creates the empty pre-commit revision side', () => {
	const side = emptySide();
	expect(side.revision).toBe('none');
	expect(side.entries).toEqual([]);
	expect(side.graph).toEqual({ nodes: [], edges: [], uncertain: [] });
	recordExampleCases(
		{
			unitId: 'workflow.load-revisions',
			symbol: 'emptySide',
			state: 'creates-the-empty-pre-commit-revision-side',
			evidence: 'examples-cases',
			file: 'creates-the-empty-pre-commit-revision-side.json'
		},
		[
			{
				name: 'initial side has no revision entries or graph edges',
				input: {},
				output: {
					revision: side.revision,
					entries: side.entries,
					graph: side.graph,
					indexRevision: side.index.revision,
					stored: side.stored
				}
			}
		]
	);
});

test('Rejects a root outside a Git repository', async () => {
	await withTempDir('load-revisions-not-git-', async (root) => {
		let error: unknown;
		try {
			await openRange({ root, base: 'none' });
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('inside a repository');
		recordExampleCases(
			{
				unitId: 'workflow.load-revisions',
				symbol: 'openRange',
				state: 'rejects-a-root-outside-a-git-repository',
				evidence: 'examples-cases',
				file: 'rejects-a-root-outside-a-git-repository.json'
			},
			[
				{
					name: 'non repository root raises the expected CLI error',
					input: { root, base: 'none' },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});

test('Loads an empty base against a repository working tree', async () => {
	await withTempRepo(async ({ root }) => {
		const range = await openRange({ root, base: 'none' });
		expect(range.base.revision).toBe('none');
		expect(range.head.revision).toBe('working-tree');
		recordExampleCases(
			{
				unitId: 'workflow.load-revisions',
				symbol: 'openRange',
				state: 'loads-an-empty-base-against-a-repository-working-tree',
				evidence: 'examples-cases',
				file: 'loads-an-empty-base-against-a-repository-working-tree.json'
			},
			[
				{
					name: 'none selects an empty base and the current working tree head',
					input: { root, base: 'none' },
					output: {
						root: range.root,
						baseRevision: range.base.revision,
						headRevision: range.head.revision,
						baseEntries: range.base.entries.length
					}
				}
			]
		);
	});
});

test('Loads a compact reason side for a repository commit', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('commit', '--allow-empty', '-m', 'initial');
		const commit = git('rev-parse', 'HEAD');
		const side = await commitLoader(root)(commit);
		expect(side.manifests).toEqual([]);
		expect(side.index.files.size).toBe(0);
		recordExampleCases(
			{
				unitId: 'workflow.load-revisions',
				symbol: 'commitLoader',
				state: 'loads-a-compact-reason-side-for-a-repository-commit',
				evidence: 'examples-cases',
				file: 'loads-a-compact-reason-side-for-a-repository-commit.json'
			},
			[
				{
					name: 'empty commit produces no indexed files or active manifests',
					input: { root, commit },
					output: {
						manifestCount: side.manifests.length,
						fileCount: side.index.files.size
					}
				}
			]
		);
	});
});
