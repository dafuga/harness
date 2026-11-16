import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { CommitTreeAdapter } from '../../src/adapters/git-source-history/CommitTreeAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

function commitFile(repo: TemporaryRepo, path: string, contents: string): void {
	const fullPath = join(repo.root, path);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, contents);
	repo.git('add', '--', path);
	repo.git('commit', '-m', `Update ${path}`);
}

test('Opens a revision expression as a commit', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'src/app.ts', 'export const version = 1;\n');
		const firstRevision = repo.git('rev-parse', 'HEAD');
		commitFile(repo, 'src/app.ts', 'export const version = 2;\n');

		const adapter = await CommitTreeAdapter.open(repo.root, 'HEAD^');
		expect(adapter.revision).toBe(firstRevision);

		let openError: unknown;
		try {
			await CommitTreeAdapter.open(repo.root, 'missing-reference');
		} catch (error) {
			openError = error;
		}
		expect(openError).toMatchObject({ name: 'ExpectedCliError' });

		recordExampleCases(
			{
				unitId: 'adapter.commit-tree',
				symbol: 'CommitTreeAdapter.open',
				state: 'opens-a-revision-expression-as-a-commit',
				evidence: 'examples-cases',
				file: 'opens-a-revision-expression-as-a-commit.json'
			},
			[
				{
					name: 'Resolves the parent commit expression',
					input: { root: '<temporary Git repository>', reference: 'HEAD^' },
					output: { revision: adapter.revision }
				},
				{
					name: 'Rejects a reference that is not a commit',
					input: { root: '<temporary Git repository>', reference: 'missing-reference' },
					error: {
						name: (openError as Error).name,
						message: (openError as Error).message
					}
				}
			]
		);
	});
});

test('Lists blob files from the selected commit', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'src/app.ts', 'export const version = 1;\n');
		commitFile(repo, 'README.md', 'Current branch documentation.\n');

		const selectedRevision = repo.git('rev-parse', 'HEAD^');
		const expectedBlobHash = repo.git('rev-parse', `${selectedRevision}:src/app.ts`);
		const adapter = await CommitTreeAdapter.open(repo.root, 'HEAD^');
		const entries = await adapter.list();

		expect(entries).toEqual([{ path: 'src/app.ts', hash: expectedBlobHash }]);
		recordExampleCases(
			{
				unitId: 'adapter.commit-tree',
				symbol: 'CommitTreeAdapter.list',
				state: 'lists-blob-files-from-the-selected-commit',
				evidence: 'examples-cases',
				file: 'lists-blob-files-from-the-selected-commit.json'
			},
			[
				{
					name: 'Lists tracked blobs from the selected parent commit',
					input: { root: '<temporary Git repository>', reference: 'HEAD^' },
					output: entries
				}
			]
		);
	});
});

test('Reads contents from the selected commit', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'docs/guide.md', 'Guide from the first commit.\n');
		commitFile(repo, 'docs/guide.md', 'Guide from the current commit.\n');

		const adapter = await CommitTreeAdapter.open(repo.root, 'HEAD^');
		const contents = await adapter.read('docs/guide.md');
		expect(contents).toBe('Guide from the first commit.\n');

		let readError: unknown;
		try {
			await adapter.read('docs/missing.md');
		} catch (error) {
			readError = error;
		}
		expect(readError).toMatchObject({ name: 'CommitFileNotFoundError' });

		recordExampleCases(
			{
				unitId: 'adapter.commit-tree',
				symbol: 'CommitTreeAdapter.read',
				state: 'reads-contents-from-the-selected-commit',
				evidence: 'examples-cases',
				file: 'reads-contents-from-the-selected-commit.json'
			},
			[
				{
					name: 'Reads the blob contents from the selected parent commit',
					input: { root: '<temporary Git repository>', reference: 'HEAD^', path: 'docs/guide.md' },
					output: contents
				},
				{
					name: 'Reports a path absent from the selected commit',
					input: {
						root: '<temporary Git repository>',
						reference: 'HEAD^',
						path: 'docs/missing.md'
					},
					error: {
						name: (readError as Error).name,
						message: (readError as Error).message
					}
				}
			]
		);
	});
});
