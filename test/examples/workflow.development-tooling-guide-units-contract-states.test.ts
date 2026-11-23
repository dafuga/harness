import type {
	Contract,
	Groups
} from './workflow.development-tooling-guide-units-contract-states.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	contractStates,
	mergeUnitStates,
	unitStateName
} from '../../src/workflows/development-tooling/guide-units/contractStates';

const unitId = 'workflow.development-tooling-guide-units-contract-states';
const entity = 'workflow.development-tooling-guide-units-contract-states';
const slotPrefix = 'workflow-development-tooling-guide-units-contract-states';

function cardContract(): Contract {
	return {
		origin: 'declared',
		inputs: [
			{ name: 'Card.status', type: "'loading' | 'ready'", required: true },
			{ name: 'Card.subtitle', type: 'string', required: false },
			{ name: 'Card.tags', type: 'string[]', required: true },
			{ name: 'Card.showBadge', type: 'boolean', required: true }
		],
		outputs: [
			{ name: 'Card.render', type: 'string', description: 'Empty list when nothing matches.' }
		],
		errors: [],
		errorStatus: 'none-found'
	};
}

function stateGroups(): Groups {
	return [
		[
			{ name: 'empty-entity', origin: 'GUESS', reasons: ['Prop unitStateName.entity (string).'] },
			{ name: 'empty-state', origin: 'GUESS', reasons: ['Prop unitStateName.state (string).'] }
		],
		[
			{
				name: 'loading',
				origin: 'REQUIRED',
				reasons: ["Prop Panel.status ('loading' | 'ready')."]
			},
			{ name: 'empty-state', origin: 'GUESS', reasons: ['Contract mentions empty.'] }
		],
		[]
	];
}

test('Infers prop and keyword boundaries from a contract', () => {
	const contract = cardContract();
	const states = contractStates(contract);
	const empty = contractStates({ ...contract, inputs: [], outputs: [] });

	expect(states.map((state) => state.name)).toEqual([
		'loading',
		'ready',
		'without-subtitle',
		'with-subtitle',
		'empty-subtitle',
		'empty-tags',
		'tags-none',
		'tags-one',
		'tags-many',
		'no-badge',
		'empty',
		'none',
		'one',
		'many'
	]);
	expect(states[0]).toEqual({
		name: 'loading',
		origin: 'REQUIRED',
		reasons: ["Prop Card.status ('loading' | 'ready')."]
	});
	expect(states.find((state) => state.name === 'with-subtitle')?.origin).toBe('GUESS');
	expect(empty).toEqual([]);

	recordExampleCases(
		{
			unitId,
			symbol: 'contractStates',
			state: 'infers-prop-and-keyword-boundaries-from-a-contract',
			evidence: 'examples-cases',
			file: 'infers-prop-and-keyword-boundaries-from-a-contract.json'
		},
		[
			{
				name: 'card contract with literal, optional, string, array, show-flag props and an empty-list output',
				input: { contract },
				output: states
			},
			{
				name: 'contract with no inputs and no keyword prose yields no states',
				input: { contract: { ...contract, inputs: [], outputs: [] } },
				output: empty
			}
		]
	);
});

test('Merges state groups and upgrades guesses to required', () => {
	const groups = stateGroups();
	const before = JSON.stringify(groups);
	const merged = mergeUnitStates(groups);
	const upgradeInput: Groups = [
		[{ name: 'loading', origin: 'REQUIRED', reasons: ['Prop Panel.status.'] }],
		[{ name: 'loading', origin: 'GUESS', reasons: ['Contract mentions loading.'] }]
	];
	const upgraded = mergeUnitStates(upgradeInput);

	expect(merged.map((state) => state.name)).toEqual(['empty-entity', 'empty-state', 'loading']);
	expect(merged[1]).toEqual({
		name: 'empty-state',
		origin: 'GUESS',
		reasons: ['Prop unitStateName.state (string).', 'Contract mentions empty.']
	});
	expect(merged[2]?.origin).toBe('REQUIRED');
	expect(upgraded).toEqual([
		{
			name: 'loading',
			origin: 'REQUIRED',
			reasons: ['Prop Panel.status.', 'Contract mentions loading.']
		}
	]);
	expect(JSON.stringify(groups)).toBe(before);

	recordExampleCases(
		{
			unitId,
			symbol: 'mergeUnitStates',
			state: 'merges-state-groups-and-upgrades-guesses-to-required',
			evidence: 'examples-cases',
			file: 'merges-state-groups-and-upgrades-guesses-to-required.json'
		},
		[
			{
				name: 'two guessed groups and an empty group merge in first-seen order with a required upgrade',
				input: { groups },
				output: merged
			},
			{
				name: 'a guessed duplicate of a required state keeps the REQUIRED origin and both reasons',
				input: { groups: upgradeInput },
				output: upgraded
			}
		]
	);
});

test('Resolves entity-specific catalog slot names', () => {
	const cases = [
		{ state: 'loading', expected: 'loading' },
		{ state: `${slotPrefix}-empty`, expected: 'empty' },
		{ state: slotPrefix, expected: 'default' },
		{ state: '', expected: 'default' },
		{ state: `${slotPrefix}-`, expected: '' },
		{ state: 'function-unit-types-error', expected: 'function-unit-types-error' }
	];
	const results = cases.map((item) => unitStateName(entity, item.state));

	expect(results).toEqual(cases.map((item) => item.expected));
	expect(unitStateName(entity, `${slotPrefix}-empty`)).toBe('empty');

	recordExampleCases(
		{
			unitId,
			symbol: 'unitStateName',
			state: 'resolves-entity-specific-catalog-slot-names',
			evidence: 'examples-cases',
			file: 'resolves-entity-specific-catalog-slot-names.json'
		},
		cases.map((item, index) => ({
			name: `entity slot input "${item.state}"`,
			input: { entity, state: item.state },
			output: results[index]
		}))
	);
});
