import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { ContractEntry, ContractMap, ContractSummary } from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { renderContracts } from '../../src/commands/development-tooling/contracts-command/renderContracts';

const unitId = 'command.development-tooling-contracts-command-render-contracts';
const summary: ContractSummary = {
	id: 'command.sample',
	kind: 'command',
	title: 'Sample command',
	path: 'src/commands/sample.ts',
	contractPath: 'specification/units/command.sample.json',
	responsibility: 'Reads a sample contract.'
};

test('Lists contract summaries compactly', () => {
	const result = [summary];
	const output = renderContracts('list', result);
	expect(output).toBe('command.sample  src/commands/sample.ts  Reads a sample contract.');
	recordExampleCases(
		{ unitId, symbol: 'renderContracts', state: 'lists-contract-summaries-compactly', evidence: 'examples-cases', file: 'lists-contract-summaries-compactly.json' },
		[{ name: 'one summary', input: { operation: 'list', result }, output }]
	);
});

test('Shows complete stored contract fields', () => {
	const entry = {
		...summary,
		manifest: {
			status: 'active',
			owns: { source: ['src/commands/sample.ts'] },
			contract: { inputs: ['query'], outputs: ['text'] },
			helperContracts: {},
			dependencies: [],
			scenarios: []
		},
		states: [{ scenario: 'sample-flow', name: 'ready' }]
	} as unknown as ContractEntry;
	const result = [entry];
	const output = renderContracts('show', result);
	expect(output).toContain('# command.sample (command, active)');
	expect(output).toContain('Declared states:');
	recordExampleCases(
		{ unitId, symbol: 'renderContracts', state: 'shows-complete-stored-contract-fields', evidence: 'examples-cases', file: 'shows-complete-stored-contract-fields.json' },
		[{ name: 'full contract entry', input: { operation: 'show', result }, output }]
	);
});

test('Searches ranked contract matches', () => {
	const result = [{ ...summary, field: 'responsibility', snippet: 'Reads a sample contract.', score: 2 }];
	const output = renderContracts('search', result);
	expect(output).toBe('command.sample  src/commands/sample.ts  responsibility: Reads a sample contract.');
	recordExampleCases(
		{ unitId, symbol: 'renderContracts', state: 'searches-ranked-contract-matches', evidence: 'examples-cases', file: 'searches-ranked-contract-matches.json' },
		[{ name: 'ranked responsibility match', input: { operation: 'search', result }, output }]
	);
});

test('Maps contract relationships and unresolved ids', () => {
	const result: ContractMap = {
		query: 'src/commands/sample.ts', matches: [summary], dependencies: [], dependents: [], unresolved: ['command.missing']
	};
	const output = renderContracts('map', result);
	expect(output).toContain('matches:\n  command.sample  src/commands/sample.ts  Reads a sample contract.');
	expect(output).toContain('unresolved: command.missing');
	recordExampleCases(
		{ unitId, symbol: 'renderContracts', state: 'maps-contract-relationships-and-unresolved-ids', evidence: 'examples-cases', file: 'maps-contract-relationships-and-unresolved-ids.json' },
		[{ name: 'map with unresolved reference', input: { operation: 'map', result }, output }]
	);
});
