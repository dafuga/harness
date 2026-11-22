import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { runContracts } from '../../src/commands/development-tooling/contracts-command/runContracts';

const UNIT_ID = 'command.development-tooling-contracts-command-run-contracts';

test('Lists no contracts from an empty root as JSON', async () => {
	await withTempDir('run-contracts-empty-', async (directory) => {
		const options = { root: directory, json: true };
		const output = await runContracts('list', '', options);

		expect(output).toBe('[]');
		expect(JSON.parse(output)).toEqual([]);
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'runContracts',
				state: 'lists-no-contracts-from-an-empty-root-as-json',
				evidence: 'examples-cases',
				file: 'lists-no-contracts-from-an-empty-root-as-json.json'
			},
			[
				{
					name: 'list in an empty root with json output',
					input: { operation: 'list', query: '', options },
					output: JSON.parse(output)
				}
			]
		);
	});
});

test('Rejects a show query that matches no contract', async () => {
	await withTempDir('run-contracts-missing-', async (directory) => {
		const options = { root: directory, json: false };
		const message = await runContracts('show', 'missing.contract', options).then(
			() => 'resolved',
			(caught: unknown) => (caught instanceof Error ? caught.message : 'not an Error')
		);

		expect(message).toBe('No contracts match "missing.contract".');
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'runContracts',
				state: 'rejects-a-show-query-that-matches-no-contract',
				evidence: 'examples-cases',
				file: 'rejects-a-show-query-that-matches-no-contract.json'
			},
			[
				{
					name: 'show a query with no matching contract in an empty root',
					input: { operation: 'show', query: 'missing.contract', options },
					error: message
				}
			]
		);
	});
});
