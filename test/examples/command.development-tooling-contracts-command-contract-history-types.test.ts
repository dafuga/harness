import { test } from 'vitest';
import * as contractHistoryTypes from '../../src/commands/development-tooling/contracts-command/contractHistory.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The contractHistory types module declares types and interfaces only, so its real code is the
 * module itself: loading it yields no runtime value. The loaded module is checked for runtime
 * exports, and each type the module owns is looked up on it. What was given and what came back
 * are the state's cases.
 */

/** Every type the module owns, in its manifest's order. Each is declared as a type or interface. */
const ownedTypeNames = [
	'ContractJsonValue',
	'ContractJsonField',
	'StoredContract',
	'ContractHistoryOptions',
	'ContractFieldChange',
	'ContractChange',
	'ContractFieldCounts',
	'ContractChangeSummary',
	'ContractDiff',
	'ContractCommitChange',
	'ContractLog',
	'ContractSnapshotContext',
	'ContractHistoryReader',
	'ContractHistoryCommit',
	'ContractLogContext',
	'ContractHistoryIdentity'
];

test('Importing the contract history types yields no runtime value', () => {
	const runtimeExports = Object.keys(contractHistoryTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in contractHistoryTypes);
	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-contract-history-types',
			symbol: 'contractHistory.types',
			state: 'importing-the-contract-history-types-yields-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-contract-history-types-yields-no-runtime-value.json'
		},
		[
			{
				name: 'import the module from its source file',
				input: {
					module: 'src/commands/development-tooling/contracts-command/contractHistory.types.ts'
				},
				output: { runtimeExports }
			},
			{
				name: 'look up each type the module owns in the loaded module',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			}
		]
	);
});
