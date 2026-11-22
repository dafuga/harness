import { test } from 'vitest';
import * as contractsTypes from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The contracts types module declares types and interfaces only, so its real code is the module
 * itself: loading it yields no runtime value. The loaded module is checked for runtime exports,
 * and each type the module owns is looked up on it. What was given and what came back are the
 * state's cases.
 */

/** Every type the module owns, in its contract's output order. Each is declared as a type or interface. */
const ownedTypeNames = [
	'ContractEntry',
	'ContractSummary',
	'ContractOptions',
	'ContractMatch',
	'ContractMap',
	'ContractField'
];

test('Importing the contracts types yields no runtime value', () => {
	const runtimeExports = Object.keys(contractsTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in contractsTypes);
	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-contracts-types',
			symbol: 'contracts.types',
			state: 'importing-the-contracts-types-yields-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-contracts-types-yields-no-runtime-value.json'
		},
		[
			{
				name: 'import the module from its source file',
				input: {
					module: 'src/commands/development-tooling/contracts-command/contracts.types.ts'
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
