import type { ComponentManifest } from '../../../src/core/unitTypes';

/** Executable authored fixture; every repair run writes an independent manifest. */
export const sampleUnit: ComponentManifest = {
	schemaVersion: 1,
	id: 'function.sample',
	kind: 'function',
	title: 'Sample value',
	responsibility: 'Supplies the synthetic selected fixture value.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: ['source.ts'], symbols: ['selectedValue'] },
	contract: {
		origin: 'declared',
		inputs: [],
		outputs: [
			{
				name: 'selectedValue',
				type: 'number',
				description: 'Selected synthetic value.',
				examples: [3]
			}
		],
		errors: []
	},
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: 'source.ts',
		targets: [{ kind: 'module', entry: 'source.ts' }]
	},
	scenarios: ['sample-screen'],
	testing: {
		version: 1,
		shape: 'helper',
		states: ['input'],
		examples: [
			{
				subject: 'selectedValue',
				name: 'Selected value',
				call: 'selectedValue()',
				input: [],
				expected: { kind: 'value', value: 3 }
			}
		],
		cases: [
			{
				id: 'selected-value',
				state: 'input',
				subject: 'selectedValue',
				example: 'Selected value',
				test: { file: 'proof.ts', title: 'selectedValue: Selected value' }
			}
		]
	},
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};
