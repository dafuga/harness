import { expect } from 'vitest';
import { z } from 'zod';
import { componentManifestSchema } from '../../src/core/unitTypes';
import { unitSchema } from '../../src/cli/program/inspectUnits';
import { ModuleTaskService } from '../../src/services/agents-providers/ModuleTaskService';
import { indexFiles, unitOf } from './memoryTree';
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
	expect(() => service.json(circular, [])).toThrow(RangeError);
}

/** Authored expected results survive registry parsing and both schema-export boundaries. */
export async function assertAuthoredJsonFields(service: TestExpectationService) {
	expect(() => unitSchema('ComponentManifest')).not.toThrow();
	expect(() => new ModuleTaskService().schema()).not.toThrow();
	const unit = unitOf(
		await indexFiles({
			'src/utils/echo.ts': 'export function echo(value: unknown): unknown { return value; }'
		}),
		'function.echo'
	);
	const raw = JSON.parse('{"__proto__":{"value":1},"nested":[{"__proto__":null}]}');
	const example = { name: 'Wire fields', call: 'echo(input)', input: [raw], output: raw };
	const testing = {
		version: 1,
		shape: 'helper',
		states: ['input'],
		cases: [
			{
				id: 'wire-fields',
				state: 'input',
				subject: 'echo',
				example: 'Wire fields',
				test: { file: 'test/echo.test.ts', title: 'echo: Wire fields' }
			}
		]
	};
	const contract = {
		...unit.contract,
		inputs: unit.contract.inputs.map((field) => ({ ...field, examples: [raw] }))
	};
	const canonical = {
		...unit,
		contract,
		helperContracts: [],
		testing: {
			...testing,
			examples: [{ subject: 'echo', ...example, expected: { kind: 'value', value: raw } }]
		}
	};
	delete (canonical.testing.examples[0] as { output?: unknown }).output;
	await assertExampleFields(service, canonical, raw);
	const legacy = {
		...unit,
		contract,
		testing,
		helperContracts: [
			{
				name: 'echo',
				source: 'src/utils/echo.ts',
				inputs: [],
				output: 'unknown',
				pure: true,
				consumers: [{ unit: 'function.fixture-a' }, { unit: 'function.fixture-b' }],
				examples: [example]
			}
		]
	};
	await assertExampleFields(service, legacy, raw);
}

async function assertExampleFields(
	service: TestExpectationService,
	fixture: unknown,
	raw: unknown
) {
	const parsed = componentManifestSchema.parse(fixture);
	const runners: Array<() => Promise<void>> = [];
	const observed: unknown[] = [];
	service.registerExamples((_title, run) => runners.push(run), parsed, {
		echo: (value) => {
			observed.push(value);
			return value;
		}
	});
	for (const run of runners) await run();
	expect(observed, 'authored JSON data must retain every field').toEqual([raw]);
	expect(parsed.contract.inputs[0].examples).toEqual([raw]);
	if (parsed.testing?.examples)
		expect(parsed.testing.examples[0].expected).toEqual({ kind: 'value', value: raw });
	if (parsed.helperContracts?.length)
		expect(parsed.helperContracts[0].examples?.[0].output).toEqual(raw);
}
