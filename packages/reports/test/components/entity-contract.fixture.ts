import { contractFields } from '../../src/utils/contractFields';
import { unit as fixtureUnit } from '../explorerFixture';

export const propContract = {
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
