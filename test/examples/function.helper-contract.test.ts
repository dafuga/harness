import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { helperContract } from '../../src/utils/development-tooling/helperContract';
import type { CallableContract } from '../../src/utils/development-tooling/helperContract.types';

const summaryAndExport = {
	pure: true,
	consumers: [
		{ unit: 'component.summary', symbol: 'SummaryCard' },
		{ unit: 'service.export', symbol: 'exportSummary' }
	]
} satisfies CallableContract;

const impureHelper = {
	pure: false,
	consumers: [{ unit: 'component.summary' }, { unit: 'service.export' }]
} satisfies CallableContract;

const singleConsumer = {
	pure: true,
	consumers: [{ unit: 'component.summary' }]
} satisfies CallableContract;

const missingPure = {
	consumers: [{ unit: 'component.summary' }, { unit: 'service.export' }]
} satisfies CallableContract;

const repeatedPair = {
	pure: true,
	consumers: [
		{ unit: 'component.summary', symbol: 'SummaryCard' },
		{ unit: 'component.summary', symbol: 'SummaryCard' }
	]
} satisfies CallableContract;

const missingConsumers = { pure: true } satisfies CallableContract;

test('Pure helper with two distinct consumers is eligible', () => {
	const result = helperContract(summaryAndExport);

	expect(result).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.helper-contract',
			symbol: 'helperContract',
			state: 'pure-helper-with-two-distinct-consumers-is-eligible',
			evidence: 'examples-cases',
			file: 'pure-helper-with-two-distinct-consumers-is-eligible.json'
		},
		[
			{
				name: 'pure helper consumed by SummaryCard and exportSummary',
				input: summaryAndExport,
				output: result
			}
		]
	);
});

test('Impure or unpinned helpers are not eligible', () => {
	const results = [impureHelper, missingPure, singleConsumer].map((helper) =>
		helperContract(helper)
	);

	expect(results).toEqual([false, false, false]);
	recordExampleCases(
		{
			unitId: 'function.helper-contract',
			symbol: 'helperContract',
			state: 'impure-or-unpinned-helpers-are-not-eligible',
			evidence: 'examples-cases',
			file: 'impure-or-unpinned-helpers-are-not-eligible.json'
		},
		[
			{ name: 'pure is false with two consumers', input: impureHelper, output: results[0] },
			{ name: 'pure is missing with two consumers', input: missingPure, output: results[1] },
			{ name: 'pure with only one consumer', input: singleConsumer, output: results[2] }
		]
	);
});

test('Repeated consumer pairs count once', () => {
	const results = [repeatedPair, missingConsumers].map((helper) => helperContract(helper));

	expect(results).toEqual([false, false]);
	recordExampleCases(
		{
			unitId: 'function.helper-contract',
			symbol: 'helperContract',
			state: 'repeated-consumer-pairs-count-once',
			evidence: 'examples-cases',
			file: 'repeated-consumer-pairs-count-once.json'
		},
		[
			{
				name: 'same unit and symbol listed twice counts as one consumer',
				input: repeatedPair,
				output: results[0]
			},
			{ name: 'consumers list is missing', input: missingConsumers, output: results[1] }
		]
	);
});

test('Malformed contract values throw a TypeError', () => {
	const nullHelper = null as unknown as CallableContract;
	const nullEntry = { pure: true, consumers: [null] } as unknown as CallableContract;

	expect(() => helperContract(nullHelper)).toThrow(TypeError);
	expect(() => helperContract(nullEntry)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'function.helper-contract',
			symbol: 'helperContract',
			state: 'malformed-contract-values-throw-a-typeerror',
			evidence: 'examples-cases',
			file: 'malformed-contract-values-throw-a-typeerror.json'
		},
		[
			{ name: 'helper is null', input: null, error: 'TypeError' },
			{ name: 'consumers contains a null entry', input: nullEntry, error: 'TypeError' }
		]
	);
});
