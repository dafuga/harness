import type { ExampleCase } from './function.comparison-context.test.types';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import {
	comparisonSchema,
	roundsProtocol,
	warmupCalls
} from '../../src/core/development-tooling/comparisonTypes';
import {
	comparisonContext,
	requestDigest
} from '../../src/utils/development-tooling/comparison-context/comparisonContext';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const sum = { operation: 'sum', input: { values: [2, 3] } };
const sumKeysReordered = { input: { values: [2, 3] }, operation: 'sum' };
const sumWithUndefinedField = { operation: 'sum', input: { values: [2, 3] }, label: undefined };
const sumValuesSwapped = { operation: 'sum', input: { values: [3, 2] } };
const multiply = { operation: 'multiply', input: { values: [2, 3] } };
const sampling = { rounds: 5, iterations: 10 };

/** The canonical text of the sum request, with keys sorted at every depth. */
const sumCanonical = '{"input":{"values":[2,3]},"operation":"sum"}';
const sumDigest = createHash('sha256').update(sumCanonical).digest('hex');

/** Runs one call; a refusal is kept as the name of the error it threw. */
function outcome(name: string, input: unknown, call: () => unknown): ExampleCase {
	try {
		return { name, input, output: call() };
	} catch (error) {
		return { name, input, error: error instanceof Error ? error.name : String(error) };
	}
}

test('requestDigest hashes equal requests alike whatever their key order and differently when a value changes', () => {
	const digest = requestDigest(sum);
	expect(digest).toBe(sumDigest);
	expect(requestDigest(sumKeysReordered)).toBe(digest);
	expect(requestDigest(sumWithUndefinedField)).toBe(digest);
	expect(requestDigest(sumValuesSwapped)).not.toBe(digest);
	recordExampleCases(
		{
			unitId: 'function.comparison-context',
			symbol: 'requestDigest',
			state: 'requestdigest-hashes-equal-requests-alike-whatever-their-key',
			evidence: 'examples-cases',
			file: 'requestdigest-hashes-equal-requests-alike-whatever-their-key.json'
		},
		[
			{ name: 'sum request with values [2, 3]', input: sum, output: digest },
			{
				name: 'same sum request with its keys in another order',
				input: sumKeysReordered,
				output: requestDigest(sumKeysReordered)
			},
			{
				name: 'same sum request with an undefined label field',
				input: sumWithUndefinedField,
				output: requestDigest(sumWithUndefinedField)
			},
			{
				name: 'sum request with values [3, 2]',
				input: sumValuesSwapped,
				output: requestDigest(sumValuesSwapped)
			}
		]
	);
});

test('comparisonContext states the request digest, the public-invocation boundary and the sampling used', () => {
	const context = comparisonContext(sum, sampling);
	const reordered = comparisonContext(sumKeysReordered, sampling);
	const other = comparisonContext(multiply, sampling);
	expect(context).toEqual({
		request: sumDigest,
		boundary: 'public-invocation',
		protocol: roundsProtocol,
		sampling: { warmup: warmupCalls, rounds: 5, iterations: 10 }
	});
	expect(reordered.request).toBe(context.request);
	expect(other.request).not.toBe(context.request);
	expect(comparisonSchema.safeParse(context).success).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.comparison-context',
			symbol: 'comparisonContext',
			state: 'comparisoncontext-states-the-request-digest-the-public-invoc',
			evidence: 'examples-cases',
			file: 'comparisoncontext-states-the-request-digest-the-public-invoc.json'
		},
		[
			{
				name: 'sum request sampled over 5 rounds of 10 iterations',
				input: { request: sum, sampling },
				output: context
			},
			{
				name: 'same sum request with its keys in another order',
				input: { request: sumKeysReordered, sampling },
				output: reordered
			},
			{
				name: 'multiply request with the same sampling',
				input: { request: multiply, sampling },
				output: other
			}
		]
	);
});

test('comparisonContext copies round and iteration counts it never validates', () => {
	const zeroRounds = comparisonContext(sum, { rounds: 0, iterations: 10 });
	const fractional = comparisonContext(sum, { rounds: 5, iterations: 2.5 });
	expect(zeroRounds.sampling).toEqual({ warmup: warmupCalls, rounds: 0, iterations: 10 });
	expect(fractional.sampling.iterations).toBe(2.5);
	expect(comparisonSchema.safeParse(zeroRounds).success).toBe(false);
	expect(comparisonSchema.safeParse(fractional).success).toBe(false);
	recordExampleCases(
		{
			unitId: 'function.comparison-context',
			symbol: 'comparisonContext',
			state: 'comparisoncontext-copies-round-and-iteration-counts-it-never',
			evidence: 'examples-cases',
			file: 'comparisoncontext-copies-round-and-iteration-counts-it-never.json'
		},
		[
			{
				name: 'zero rounds passed through as given',
				input: { request: sum, sampling: { rounds: 0, iterations: 10 } },
				output: zeroRounds
			},
			{
				name: 'fractional iterations passed through as given',
				input: { request: sum, sampling: { rounds: 5, iterations: 2.5 } },
				output: fractional
			}
		]
	);
});

test('requestDigest refuses a request holding a BigInt or a circular reference', () => {
	const withBigInt = { operation: 'sum', input: { total: 10n } };
	const circular: { operation: string; input: Record<string, unknown> } = {
		operation: 'loop',
		input: {}
	};
	circular.input.self = circular.input;
	const bigIntCase = outcome(
		'sum request whose total is a BigInt',
		{ operation: 'sum', input: { total: '10n (BigInt, recorded as text)' } },
		() => requestDigest(withBigInt)
	);
	const circularCase = outcome(
		'loop request whose input refers to itself',
		{ operation: 'loop', input: { self: '[circular reference to input]' } },
		() => requestDigest(circular)
	);
	expect(bigIntCase.error).toBe('TypeError');
	expect(circularCase.error).toBe('RangeError');
	recordExampleCases(
		{
			unitId: 'function.comparison-context',
			symbol: 'requestDigest',
			state: 'requestdigest-refuses-a-request-holding-a-bigint-or-a-circul',
			evidence: 'examples-cases',
			file: 'requestdigest-refuses-a-request-holding-a-bigint-or-a-circul.json'
		},
		[bigIntCase, circularCase]
	);
});
