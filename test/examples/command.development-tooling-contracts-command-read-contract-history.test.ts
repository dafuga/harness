import { test } from 'vitest';
import { readContractDiff, readContractLog } from '../../src/commands/development-tooling/contracts-command/readContractHistory';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
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
