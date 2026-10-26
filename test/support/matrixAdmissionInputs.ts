import { expect } from 'vitest';
import type { TestJson } from '../../src/core/verification-evidence/testJsonSchema.types';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import type { ContractUnit } from './testContractCases.types';

export function assertMatrixAdmissionObjects(
	unit: ContractUnit,
	service: TestContractService,
	mode: 'validate' | 'compare'
) {
	const reads = { iterator: 0, species: 0, getter: 0 };
	const values = admittedValues(reads);
	const input: Record<string, TestJson> = { values };
	input.self = input;
	const base = unit.testing.cases[0];
	const next = {
		...base,
		id: 'error',
		state: 'error',
		input,
		test: { ...base.test, title: 'error' }
	};
	const after = {
		...unit,
		testing: { ...unit.testing, states: ['ready', 'error'], cases: [base, next] }
	};
	const errors =
		mode === 'compare'
			? service.compare([unit], [after])
			: service.validate({ units: [after], scenarios: [], files: new Set([base.test.file]) });
	expect(errors).toEqual([]);
	expect(reads.iterator).toBe(0);
	expect(reads.species).toBe(0);
	if (mode === 'validate') expect(reads.getter).toBeGreaterThan(0);
	const twin: Record<string, TestJson> = { values: [1, 2] };
	twin.self = twin;
	const copy = {
		...next,
		id: 'error.copy',
		input: twin,
		test: { ...next.test, title: 'error copy' }
	};
	const repeated = { ...after, testing: { ...after.testing, cases: [base, next, copy] } };
	const duplicates =
		mode === 'compare'
			? service.compare([unit], [repeated])
			: service.validate({ units: [repeated], scenarios: [], files: new Set([base.test.file]) });
	expect(duplicates.join(' ')).toContain('duplicate matrix row');
	expect(reads.iterator).toBe(0);
	expect(reads.species).toBe(0);
}

function admittedValues(reads: { iterator: number; species: number; getter: number }) {
	const values = [1, 2];
	Object.defineProperty(values, Symbol.iterator, {
		get() {
			reads.iterator++;
			throw new Error('iterator');
		}
	});
	Object.defineProperty(values, 'constructor', {
		value: {
			get [Symbol.species]() {
				reads.species++;
				throw new Error('species');
			}
		}
	});
	Object.defineProperty(values, 0, {
		enumerable: true,
		get() {
			reads.getter++;
			return 1;
		}
	});
	return values;
}
