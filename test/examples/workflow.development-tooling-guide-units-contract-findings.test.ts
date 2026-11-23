import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	contractFindings,
	contractScopes,
	documentsState
} from '../../src/workflows/development-tooling/guide-units/contractFindings';

const input = (name: string, required?: boolean) => ({
	name,
	type: 'string',
	...(required === undefined ? {} : { required })
});

test('Finds undocumented source inputs and missing contract outcomes', () => {
	const contract = {
		inputs: [input('run.config', false)],
		outputs: [],
		errors: [],
		errorStatus: 'unknown' as const
	};
	const unit = {
		id: 'workflow.development-tooling-guide-units-contract-findings',
		title: 'contractFindings',
		runtime: { entry: 'src/example.ts' },
		contract
	} as unknown as Parameters<typeof contractFindings>[0];
	const source = {
		inputs: [input('run.config'), input('run.extra')],
		outputs: [{ name: 'run', type: 'string' }],
		errors: [{ name: 'RangeError' }],
		errorStatus: 'declared' as const,
		operations: [
			{
				name: 'run',
				inputs: [],
				outputs: [{ name: 'result', type: 'string' }],
				errors: [{ name: 'RangeError' }],
				errorStatus: 'declared' as const
			}
		]
	} as unknown as Parameters<typeof contractFindings>[1];
	const result = contractFindings(unit, source);
	expect(result.map((finding) => finding.kind)).toContain('undocumented-prop');
	recordExampleCases(
		{
			unitId: 'workflow.development-tooling-guide-units-contract-findings',
			symbol: 'contractFindings',
			state: 'finds-undocumented-source-inputs-and-missing-contract-outcom',
			evidence: 'examples-cases',
			file: 'finds-undocumented-source-inputs-and-missing-contract-outcom.json'
		},
		[
			{
				name: 'source adds an input and operation absent from documentation',
				input: { documented: contract, source },
				output: result
			}
		]
	);
});

test('Keeps root and operation contracts in separate scopes', () => {
	const contract = {
		inputs: [input('root')],
		outputs: [{ name: 'rootResult', type: 'boolean' }],
		errors: [],
		errorStatus: 'none-found' as const,
		operations: [
			{
				name: 'save',
				inputs: [input('operation')],
				outputs: [],
				errors: [],
				errorStatus: 'declared' as const
			}
		],
		initialization: [
			{ name: 'start', inputs: [], outputs: [], errors: [], errorStatus: 'declared' as const }
		],
		snippets: [
			{ name: 'example', inputs: [], outputs: [], errors: [], errorStatus: 'declared' as const }
		]
	} as unknown as Parameters<typeof contractScopes>[0];
	const result = contractScopes(contract);
	expect(result.map((scope) => scope.name)).toEqual(['', 'save', 'start', 'example']);
	recordExampleCases(
		{
			unitId: 'workflow.development-tooling-guide-units-contract-findings',
			symbol: 'contractScopes',
			state: 'keeps-root-and-operation-contracts-in-separate-scopes',
			evidence: 'examples-cases',
			file: 'keeps-root-and-operation-contracts-in-separate-scopes.json'
		},
		[
			{
				name: 'root, operation, initializer and snippet remain ordered',
				input: contract,
				output: result
			}
		]
	);
});

test('Recognises documented failure wording as a failed state', () => {
	const items = [{ name: 'result', type: 'boolean', description: 'The failure is reported.' }];
	const result = documentsState(items, 'failed');
	expect(result).toBe(true);
	recordExampleCases(
		{
			unitId: 'workflow.development-tooling-guide-units-contract-findings',
			symbol: 'documentsState',
			state: 'recognises-documented-failure-wording-as-a-failed-state',
			evidence: 'examples-cases',
			file: 'recognises-documented-failure-wording-as-a-failed-state.json'
		},
		[
			{
				name: 'failure wording documents failed',
				input: { items, state: 'failed' },
				output: result
			},
			{
				name: 'unrelated state is absent',
				input: { items, state: 'ready' },
				output: documentsState(items, 'ready')
			}
		]
	);
});
