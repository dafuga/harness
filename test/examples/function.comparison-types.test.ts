import { createHash } from 'node:crypto';
import { test } from 'vitest';
import {
	comparisonSchema,
	measurementBoundaries,
	metricUnits,
	roundsProtocol,
	warmupCalls
} from '../../src/core/comparisonTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The registered comparison schema is run on complete and incomplete benchmark contexts. Each
 * call's input and the schema's actual result, or the issues it reports, is asserted and recorded
 * as the cases of its state.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const requestDigest = createHash('sha256')
	.update('{"input":{"values":[2,3]},"operation":"sum"}')
	.digest('hex');
const complete = {
	request: requestDigest,
	boundary: 'public-invocation',
	protocol: 'harness-rounds/1',
	sampling: { warmup: 3, rounds: 5, iterations: 10 }
};

/** Runs the strict schema and returns its actual result: the parsed value or each issue. */
function parse(value: unknown): unknown {
	const result = comparisonSchema.safeParse(value);
	if (result.success) return { success: true, data: result.data };
	return {
		success: false,
		issues: result.error.issues.map(({ path, message }) => ({
			path: path.join('.'),
			message
		}))
	};
}

/** One schema call: the context given and what the schema returned for it. */
function check(name: string, input: unknown): ExampleCase {
	return { name, input, output: parse(input) };
}

test('roundsProtocol, warmupCalls, measurementBoundaries and metricUnits state the protocol and its units', () => {
	expect(roundsProtocol).toBe('harness-rounds/1');
	expect(warmupCalls).toBe(3);
	expect(measurementBoundaries).toEqual(['public-invocation', 'fixture']);
	expect(metricUnits).toEqual({
		'latency-cold-ms': 'ms',
		'latency-warm-ms': 'ms',
		'latency-floor-ms': 'ms',
		'throughput-ops': 'ops/s',
		'memory-bytes': 'bytes'
	});
	expect(Object.hasOwn(metricUnits, 'unlisted-metric')).toBe(false);
	recordExampleCases(
		{
			unitId: 'function.comparison-types',
			symbol: 'metricUnits',
			state: 'roundsprotocol-warmupcalls-measurementboundaries-and-metricu',
			evidence: 'examples-cases',
			file: 'roundsprotocol-warmupcalls-measurementboundaries-and-metricu.json'
		},
		[
			{ name: 'benchmark protocol id', input: 'roundsProtocol', output: roundsProtocol },
			{
				name: 'warm-up calls before the first timed round',
				input: 'warmupCalls',
				output: warmupCalls
			},
			{
				name: 'allowed measurement boundaries',
				input: 'measurementBoundaries',
				output: [...measurementBoundaries]
			},
			{
				name: 'unit of latency-cold-ms',
				input: 'latency-cold-ms',
				output: metricUnits['latency-cold-ms']
			},
			{
				name: 'unit of throughput-ops',
				input: 'throughput-ops',
				output: metricUnits['throughput-ops']
			},
			{ name: 'unit of memory-bytes', input: 'memory-bytes', output: metricUnits['memory-bytes'] },
			{
				name: 'unlisted metric has no unit entry',
				input: 'unlisted-metric',
				output: Object.hasOwn(metricUnits, 'unlisted-metric')
			}
		]
	);
});

test('comparisonSchema accepts a complete context for each allowed measurement boundary', () => {
	const publicInvocation = parse(complete);
	const fixture = parse({ ...complete, boundary: 'fixture' });
	expect(publicInvocation).toEqual({ success: true, data: complete });
	expect(fixture).toEqual({ success: true, data: { ...complete, boundary: 'fixture' } });
	recordExampleCases(
		{
			unitId: 'function.comparison-types',
			symbol: 'comparisonSchema',
			state: 'comparisonschema-accepts-a-complete-context-for-each-allowed',
			evidence: 'examples-cases',
			file: 'comparisonschema-accepts-a-complete-context-for-each-allowed.json'
		},
		[
			check('complete context timed as public-invocation over 5 rounds of 10 iterations', complete),
			check('complete context timed as fixture over 5 rounds of 10 iterations', {
				...complete,
				boundary: 'fixture'
			})
		]
	);
});

test('comparisonSchema refuses an incomplete context and reports each missing field', () => {
	const { request, ...withoutRequest } = complete;
	const { boundary, ...withoutBoundary } = complete;
	const { protocol, ...withoutProtocol } = complete;
	const { sampling, ...withoutSampling } = complete;
	const workloadNameOnly = { workload: 'sum' };
	const cases = [
		check('context without its request digest', withoutRequest),
		check('context without its boundary', withoutBoundary),
		check('context without its protocol', withoutProtocol),
		check('context without its sampling', withoutSampling),
		check('workload name alone', workloadNameOnly)
	];
	for (const { output } of cases) {
		expect((output as { success: boolean }).success).toBe(false);
	}
	expect(request).toBe(requestDigest);
	expect(boundary).toBe('public-invocation');
	expect(protocol).toBe('harness-rounds/1');
	expect(sampling).toEqual({ warmup: 3, rounds: 5, iterations: 10 });
	recordExampleCases(
		{
			unitId: 'function.comparison-types',
			symbol: 'comparisonSchema',
			state: 'comparisonschema-refuses-an-incomplete-context-and-reports-e',
			evidence: 'examples-cases',
			file: 'comparisonschema-refuses-an-incomplete-context-and-reports-e.json'
		},
		cases
	);
});

test('comparisonSchema refuses a malformed value in each field', () => {
	const cases = [
		check('request digest in upper-case hex', {
			...complete,
			request: requestDigest.toUpperCase()
		}),
		check('request digest of 63 hex characters', { ...complete, request: requestDigest.slice(1) }),
		check('blank protocol after trimming', { ...complete, protocol: '   ' }),
		check('boundary outside the allowed two', { ...complete, boundary: 'whole-run' }),
		check('negative warm-up count', {
			...complete,
			sampling: { ...complete.sampling, warmup: -1 }
		}),
		check('zero rounds', { ...complete, sampling: { ...complete.sampling, rounds: 0 } }),
		check('zero iterations', { ...complete, sampling: { ...complete.sampling, iterations: 0 } }),
		check('fractional iterations', {
			...complete,
			sampling: { ...complete.sampling, iterations: 2.5 }
		})
	];
	for (const { output } of cases) {
		expect((output as { success: boolean }).success).toBe(false);
	}
	recordExampleCases(
		{
			unitId: 'function.comparison-types',
			symbol: 'comparisonSchema',
			state: 'comparisonschema-refuses-a-malformed-value-in-each-field',
			evidence: 'examples-cases',
			file: 'comparisonschema-refuses-a-malformed-value-in-each-field.json'
		},
		cases
	);
});

test('comparisonSchema rejects unknown keys at the top level and inside sampling', () => {
	const cases = [
		check('context with an extra top-level key', { ...complete, workload: 'sum' }),
		check('sampling with an extra key', {
			...complete,
			sampling: { ...complete.sampling, seed: 7 }
		})
	];
	for (const { output } of cases) {
		expect((output as { success: boolean }).success).toBe(false);
	}
	recordExampleCases(
		{
			unitId: 'function.comparison-types',
			symbol: 'comparisonSchema',
			state: 'comparisonschema-rejects-unknown-keys-at-the-top-level-and-i',
			evidence: 'examples-cases',
			file: 'comparisonschema-rejects-unknown-keys-at-the-top-level-and-i.json'
		},
		cases
	);
});
