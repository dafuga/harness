import { expect } from 'vitest';
import type { ComponentManifest } from '../../src/core/unitTypes';
import type { ContractCase } from '../../src/services/verification-evidence/TestContractService';
import type { TestCaseValidator } from '../../src/validators/verification-evidence/TestCaseValidator';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import type { ContractUnit } from './testContractCases.types';
import type { ExampleReads, AdmittedExample } from './testCaseAdmissionCases.types';

/** Invalid declarations stay in the validator's existing method/state case. */
export function observedDeclaredCases(
	validator: TestCaseValidator,
	unit: ComponentManifest,
	helper: ComponentManifest,
	item: ContractCase
) {
	const base = { version: 1, shape: 'service', states: ['rest'], cases: [item] };
	const invalid = [
		{ ...base, states: undefined, cases: [{ ...item, state: 'initialized' }] },
		{ ...base, states: ['rest', 'rest'] },
		{ ...base, cases: [{ ...item, subject: 'Runner' }] },
		{ ...base, cases: [{ ...item, expected: { kind: 'json', value: {} } }] },
		{ ...base, cases: [{ ...item, expected: { kind: 'screenshot', file: 'rank.png' } }] }
	];
	return [
		...invalid.map((contract) => validator.validate(unit, contract).valid),
		validator.validate(helper, {
			...base,
			cases: [{ ...item, subject: 'rank' }]
		}).valid
	];
}

/** A prop or error name cannot create arbitrary additional rows of an existing state. */
export function assertPropCaseInflation(unit: ContractUnit, service: TestContractService) {
	const item = unit.testing.cases[0];
	const added = { ...item, id: 'extra-row' };
	const prop = {
		...unit,
		testing: { ...unit.testing, props: ['extra'], cases: [item, { ...added, props: ['extra'] }] }
	};
	const error = {
		...unit,
		contract: { ...unit.contract, errors: [{ name: 'Unavailable', type: 'response' }] },
		testing: { ...unit.testing, cases: [item, { ...added, errors: ['Unavailable'] }] }
	};
	const observed = [prop, error].map((after) =>
		service.compare([unit], [after]).join(' ').includes('case identities/count changed')
	);
	expect(observed, 'new inputs cannot inflate an existing row').toEqual([true, true]);
}

/** Observe all authored-data contradictions before the owning case asserts admission. */
export function observedAuthoredCases(
	validator: TestCaseValidator,
	unit: ComponentManifest,
	item: ContractCase
) {
	const authored = authoredMatrix(item);
	expect(validator.validate(unit, authored).errors).toEqual([]);
	expect(
		validator
			.validate(unit, { ...authored, examples: [...authored.examples, ...authored.examples] })
			.errors.join(' ')
	).toContain('duplicate authored example');
	const changes = [
		{ expected: { kind: 'value', value: 2 } },
		{ input: [2] },
		{ call: 'rank(2)' }
	].map(
		(change) =>
			validator.validate(unit, {
				...authored,
				cases: [{ ...authored.cases[0], ...change }]
			}).valid
	);
	const unknown = validator.validate(unit, {
		...authored,
		examples: [{ ...authored.examples[0], subject: 'unowned' }],
		cases: [
			{
				...authored.cases[0],
				subject: 'unowned',
				test: { ...item.test, title: 'unowned: Identity' }
			}
		]
	}).valid;
	return [...changes, unknown];
}

function authoredMatrix(item: ContractCase) {
	return {
		version: 1,
		states: ['rest'],
		shape: 'helper',
		examples: [
			{
				subject: 'rank',
				name: 'Identity',
				call: 'rank(1)',
				input: [1],
				expected: { kind: 'value' as const, value: 1 }
			}
		],
		cases: [{ ...item, example: 'Identity', test: { ...item.test, title: 'rank: Identity' } }]
	};
}

/** Pass admitted objects directly; unused authored fields and array iterators stay untouched. */
export function assertExampleAdmissionInputs(
	validator: TestCaseValidator,
	unit: ComponentManifest,
	item: ContractCase
) {
	const reads = { name: 0, input: 0, call: 0, output: 0, iterator: 0, species: 0 };
	const example = admittedExample(reads),
		prototype = Object.getPrototypeOf(example);
	const helper = {
		name: 'rank',
		source: 'src/utils/rank.ts',
		pure: true as const,
		inputs: [],
		output: 'number',
		consumers: [{ unit: 'function.first' }, { unit: 'function.second' }],
		examples: admittedExamples(example, reads)
	};
	const contract = authoredMatrix({ ...item, subject: 'rank' });
	const expectedFree = { ...contract.cases[0] };
	delete expectedFree.expected;
	expect(
		validator.validate(
			{ ...unit, helperContracts: [helper] },
			{
				...contract,
				examples: undefined,
				cases: [expectedFree]
			}
		).errors
	).toEqual([]);
	expect(reads).toEqual({ name: 1, input: 0, call: 0, output: 0, iterator: 0, species: 1 });
	expect(Object.getPrototypeOf(example)).toBe(prototype);
}

function admittedExample(reads: ExampleReads): AdmittedExample {
	const prototype = {
		get ignored() {
			throw new Error('inherited example getter');
		}
	};
	const example: AdmittedExample = Object.assign(Object.create(prototype), {
		name: 'Identity',
		input: [1],
		call: 'rank(1)',
		output: 1
	});
	for (const key of ['name', 'input', 'call', 'output'] as const) {
		const value = example[key];
		Object.defineProperty(example, key, {
			get() {
				reads[key]++;
				return value;
			}
		});
	}
	return example;
}

function admittedExamples(example: AdmittedExample, reads: ExampleReads): AdmittedExample[] {
	const examples = [example];
	Object.defineProperty(examples, Symbol.iterator, {
		get() {
			reads.iterator++;
			throw new Error('example array iterator');
		}
	});
	Object.defineProperty(examples, 'constructor', {
		value: {
			get [Symbol.species]() {
				reads.species++;
				return Array;
			}
		}
	});
	return examples;
}
