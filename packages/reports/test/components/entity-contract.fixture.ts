import type { HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import { typeDeclarations } from '../entityClassFixtures';
import { contractFields } from '../../src/utils/explorer-ui/contractFields';
import { unit as fixtureUnit } from '../explorerFixture';

export const propContract: HarnessUnit['contract'] = {
	inputs: [
		{
			name: 'enabled',
			type: 'boolean',
			description: 'Whether the list is active.',
			required: false,
			default: false,
			examples: [false]
		},
		{ name: 'limit', type: 'number', required: false, default: 0, examples: [0] },
		{ name: 'label', type: 'string', required: false, defaultKind: 'omitted' },
		{ name: 'override', type: 'number | undefined', required: false, defaultKind: 'undefined' },
		{ name: 'computed', type: 'string', required: false },
		{
			name: 'empty',
			type: 'unknown',
			required: false,
			default: null,
			examples: [null]
		},
		{
			name: 'settings',
			type: 'object',
			required: true,
			examples: [{ label: 'Safe <tag>' }]
		}
	],
	outputs: [{ name: 'count', type: 'number', examples: [2] }],
	errors: []
};

/** In-memory input arrays retain their indexed access and species without iteration. */
export function contractArrayAdmission() {
	const admitted = fixtureUnit('app.component.order-list', 'component');
	let indexed = 0,
		species = 0;
	admitted.contract.inputs = [{ name: 'limit', type: 'number', examples: [0] }];
	const field = admitted.contract.inputs[0];
	Object.defineProperty(admitted.contract.inputs, '0', {
		get() {
			indexed++;
			return field;
		}
	});
	Object.defineProperty(admitted.contract.inputs, Symbol.iterator, {
		value() {
			throw new Error('Input iterator must stay unused');
		}
	});
	Object.defineProperty(admitted.contract.inputs, 'constructor', {
		value: {
			[Symbol.species]: function (length: number) {
				species++;
				return Array(length);
			}
		}
	});
	const value = contractFields(admitted, 'components')[0].fields[0].examples[0].value;
	return { indexed, species, value };
}

/** Shared declarations may author requirement flags for callable members explicitly. */
export function declaredTypeUnit(source: string) {
	const unit = fixtureUnit('app.model.order-input', 'model', {
		owns: { source: [source], symbols: ['OrderInput'] },
		modelDefinitions: typeDeclarations(source)
	});
	unit.contract.inputs = [
		{ name: 'OrderInput.resolve', type: '(key: string): number', required: true }
	];
	return unit;
}
