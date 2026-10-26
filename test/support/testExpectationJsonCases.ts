import { expect } from 'vitest';
import { z } from 'zod';
import type { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';

/** Wire objects keep reserved property names as data; field changes must never disappear. */
export function assertCompleteJsonFields(service: TestExpectationService) {
	for (const [before, after] of [
		['{"__proto__":1}', '{"__proto__":2}'],
		['{"nested":[{"__proto__":1}]}', '{"nested":[{"__proto__":2}]}'],
		['{"__proto__":null}', '{}'],
		['{}', '{"__proto__":null}']
	])
		expect(
			() => service.json(JSON.parse(after), JSON.parse(before)),
			'API JSON comparison must retain every wire field'
		).toThrow('API JSON differs');
}

/** Characterize admitted in-memory values directly; do not JSON-normalize these fixtures. */
export function assertJsonAdmission(service: TestExpectationService) {
	assertGetters(service);
	assertArrays(service);
	assertInvalidValues(service);
	const inherited = Object.create({
		get ignored() {
			throw new Error('inherited getter');
		}
	});
	inherited.own = 1;
	expect(() => service.json(inherited, { own: 1 })).not.toThrow();
	const response = { value: 1 };
	service.json(response, { value: 1 });
	response.value = 2;
	expect(() => service.json(response, { value: 1 })).toThrow('API JSON differs');
}

function assertGetters(service: TestExpectationService) {
	const reads: string[] = [];
	const input = {
		get first() {
			reads.push('first');
			return {
				get nested() {
					reads.push('nested');
					return 1;
				}
			};
		},
		get second() {
			reads.push('second');
			return 2;
		}
	};
	service.json(input, { first: { nested: 1 }, second: 2 });
	expect(reads).toEqual(['first', 'nested', 'second']);
	const sentinel = new Error('later getter still runs after an invalid property');
	const invalid = {
		bad: undefined,
		get after() {
			throw sentinel;
		}
	};
	let caught: unknown;
	try {
		service.json(invalid, {});
	} catch (error) {
		caught = error;
	}
	expect(caught).toBe(sentinel);
}

function assertArrays(service: TestExpectationService) {
	let iterators = 0,
		species = 0;
	const input = [1, 2];
	Object.defineProperty(input, Symbol.iterator, {
		value: () => {
			iterators++;
			return [99].values();
		}
	});
	Object.defineProperty(input, 'constructor', {
		value: {
			get [Symbol.species]() {
				species++;
				return Array;
			}
		}
	});
	Object.defineProperty(input, 'ignored', {
		enumerable: true,
		get() {
			throw new Error('non-index array getter');
		}
	});
	expect(() => service.json(input, [1, 2])).not.toThrow();
	expect({ iterators, species }).toEqual({ iterators: 0, species: 0 });
}

function assertInvalidValues(service: TestExpectationService) {
	for (const invalid of [
		undefined,
		1n,
		new Date(0),
		new Map(),
		NaN,
		Infinity,
		Symbol('value'),
		() => 1
	])
		expect(() => service.json(invalid, {})).toThrow(z.ZodError);
	const symbolKey = { [Symbol('field')]: 1 };
	expect(() => service.json(symbolKey, {})).toThrow(z.ZodError);
	expect(() => service.json(Array(1), [])).toThrow(z.ZodError);
	const circular: unknown[] = [];
	circular.push(circular);
	expect(() => service.json(circular, [])).toThrow('API JSON differs');
}
