import { expect } from 'vitest';
import type {
	RegressionInputFixture,
	ObservedRegressionRecord,
	CheckpointReads
} from './regressionInputFixture.types';

/** Exercise admitted values directly; neither the caller nor its arrays are JSON-normalized. */
export function observeRegressionRecord(base: RegressionInputFixture['red']): ObservedRegressionRecord {
	const reads = {
		source: 0,
		tests: 0,
		inputs: 0,
		testsIterator: 0,
		inputIterator: 0,
		inputItems: 0,
		species: 0
	};
	const prototype = {
		get ignored() {
			throw new Error('inherited checkpoint getter');
		}
	};
	const record: RegressionInputFixture['red'] = Object.create(
		prototype,
		Object.getOwnPropertyDescriptors(base)
	);
	for (const name of ['source', 'tests', 'inputs'] as const)
		Object.defineProperty(record, name, {
			enumerable: true,
			configurable: true,
			get() {
				reads[name]++;
				return base[name];
			}
		});
	observeArrays(base, reads);
	return {
		record,
		verify() {
			expect(reads, 'Preserve admitted checkpoint getter and array behavior').toEqual({
				source: 2, tests: 1, inputs: 1, testsIterator: 1,
				inputIterator: 0, inputItems: 1, species: 0
			});
			expect(Object.getPrototypeOf(record)).toBe(prototype);
		}
	};
}

function observeArrays(base: RegressionInputFixture['red'], reads: CheckpointReads): void {
	Object.defineProperty(base.tests, Symbol.iterator, {
		value() {
			reads.testsIterator++;
			return Array.prototype.values.call(base.tests);
		}
	});
	Object.defineProperty(base.inputs, Symbol.iterator, {
		get() {
			reads.inputIterator++;
			throw new Error('checkpoint inputs must not use an iterator');
		}
	});
	Object.defineProperty(base.inputs, 'constructor', {
		value: {
			get [Symbol.species]() {
				reads.species++;
				throw new Error('checkpoint inputs must not use array species');
			}
		}
	});
	const first = base.inputs[0];
	Object.defineProperty(base.inputs, '0', {
		enumerable: true,
		configurable: true,
		get() {
			reads.inputItems++;
			return first;
		}
	});
}
