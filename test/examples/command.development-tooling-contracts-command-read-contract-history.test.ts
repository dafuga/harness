import { test } from 'vitest';
import { readContractDiff, readContractLog } from '../../src/commands/development-tooling/contracts-command/readContractHistory';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'command.development-tooling-contracts-command-read-contract-history';

async function withEmptyRepository<T>(use: (root: string) => Promise<T>): Promise<T> {
	return withTempRepo(async ({ root, git }) => {
		git('config', 'user.name', 'Example Author');
		git('config', 'user.email', 'example@example.test');
		git('commit', '--allow-empty', '-m', 'Initial snapshot');
		return use(root);
	});
}

test('Compares an empty contract snapshot', async () =>
	withEmptyRepository(async (root) => {
	const options = { root };
	const result = await readContractDiff([], options);
	expect(result.total).toBe(0);
	expect(result.changes).toEqual([]);
	recordExampleCases(
		{
			unitId,
			symbol: 'readContractDiff',
			state: 'compares-an-empty-contract-snapshot',
			evidence: 'examples-cases',
			file: 'compares-an-empty-contract-snapshot.json'
		},
		[
			{
				name: 'working tree with no contract snapshots',
				input: { revisions: [], options: { root } },
				output: {
					base: result.base,
					head: result.head,
					total: result.total,
					truncated: result.truncated,
					changes: result.changes
				}
			}
		]
 	);
	})
);

test('Reads an empty committed contract history', async () =>
	withEmptyRepository(async (root) => {
	const options = { root };
	const result = await readContractLog('example.unit', options);
	expect(result.entries).toEqual([]);
	expect(result.scannedCommits).toBe(0);
	recordExampleCases(
		{
			unitId,
			symbol: 'readContractLog',
			state: 'reads-an-empty-committed-contract-history',
			evidence: 'examples-cases',
			file: 'reads-an-empty-committed-contract-history.json'
		},
		[
			{
				name: 'unit with no committed contract changes',
				input: { unit: 'example.unit', options: { root } },
				output: {
					head: result.head,
					scannedCommits: result.scannedCommits,
					truncated: result.truncated,
					entries: result.entries
				}
			}
		]
 	);
	})
);

test('Throws ExpectedCliError when last finds no change', async () =>
	withEmptyRepository(async (root) => {
		let caught: unknown;
		try {
			await readContractLog('example.unit', { root }, true);
		} catch (error) {
			caught = error;
		}
		expect(caught).toMatchObject({ name: 'ExpectedCliError' });
		recordExampleCases(
			{
				unitId,
				symbol: 'readContractLog',
				state: 'throws-expectedclierror-when-last-finds-no-change',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-when-last-finds-no-change.json'
			},
			[
				{
					name: 'last lookup for a unit without material history',
					input: { unit: 'example.unit', options: { root }, last: true },
					error: {
						name: (caught as Error).name,
						message: (caught as Error).message
					}
				}
			]
		);
	})
);

test('Propagates Git errors when the root is not a repository', async () =>
	withTempDir('contract-history-error-', async (root) => {
		let caught: unknown;
		try {
			await readContractDiff([], { root });
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).message).toContain('Git worktree');
		recordExampleCases(
			{
				unitId,
				symbol: 'readContractDiff',
				state: 'propagates-git-errors-when-the-root-is-not-a-repository',
				evidence: 'examples-cases',
				file: 'propagates-git-errors-when-the-root-is-not-a-repository.json'
			},
			[
				{
					name: 'working tree comparison in a directory without a Git repository',
					input: { revisions: [], options: { root } },
					error: {
						name: (caught as Error).name,
						message: (caught as Error).message
					}
				}
			]
		);
	})
);
