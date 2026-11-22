import { test } from 'vitest';
import {
	budgetEventSchema,
	performanceBaselineSchema
} from '../../src/core/verification-evidence/budgetTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * The budget ledger schemas are called the way their callers call them. BudgetLedgerRepository
 * writes each event as one JSON line and reads it back with JSON.parse and safeParse. What each
 * call was given and what it returned, or why it refused, is asserted and recorded as its cases.
 */

const commit = '6f1c2b9e0d4a7c3e8b5f1a9d2c6e0b4f7a3d8c15';
const tree = '0a9e4c7d2b5f8e1a3c6d9b0f4e7a2c5d8b1f3e6a';
const digest = 'c3a5e7f9b1d2c4e6a8f0b2d4c6e8a0f2b4d6c8e0a2f4b6d8c0e2a4f6b8d0c2e4';

const comparison = {
	request: digest,
	boundary: 'public-invocation',
	protocol: 'harness-rounds/1',
	sampling: { warmup: 3, rounds: 5, iterations: 20 }
};
const coldLatency = {
	workload: 'cold parse of a ledger line',
	metric: 'latency-cold-ms',
	target: 'module',
	profile: 'linux-x64-ci',
	value: 0.42,
	unitOfMeasure: 'ms',
	method: 'median of timed rounds',
	comparison
};
const signed = {
	unit: 'function.budget-types',
	record: { id: 'verify-2026-11-15-0930', commit, tree },
	reviewer: 'Reviewer One',
	reason: 'Baseline frozen from a clean verification record.',
	at: '2026-11-15T09:30:00.000Z'
};
const baseline = {
	type: 'baseline',
	...signed,
	metrics: { 'latency-cold-ms': 0.42, 'artifact-bytes:module': 18432 },
	performance: [coldLatency]
};
const approval = {
	type: 'approval',
	...signed,
	reason: 'Accepted the larger artifact after the parser change.',
	before: { 'artifact-bytes:module': 18432 },
	after: { 'artifact-bytes:module': 19000 },
	unmeasured: { 'latency-warm-ms': 'The runner did not repeat the warm call.' },
	performance: []
};

type Refusal = { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };
type Parsed = { success: true; data: unknown } | { success: false; error: Refusal };
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

/** The path and message of each refusal, in the order zod gives them; the root is named record. */
function reasons(error: Refusal): string[] {
	return error.issues.map((issue) => {
		const where = issue.path.length > 0 ? issue.path.join('.') : 'record';
		return `${where}: ${issue.message}`;
	});
}

/** The value a caller got back, or the reasons it was refused. */
function caseOf(name: string, input: unknown, result: Parsed): ExampleCase {
	return result.success
		? { name, input, output: result.data }
		: { name, input, error: reasons(result.error) };
}

/** A performance value is checked as given; budgetEventSchema checks each entry the same way. */
function parsePerformance(name: string, input: unknown): ExampleCase {
	return caseOf(name, input, performanceBaselineSchema.safeParse(input));
}

/** A ledger event is written as JSON and read back before it is checked, as the ledger does. */
function readEvent(name: string, event: unknown): ExampleCase {
	const input: unknown = JSON.parse(JSON.stringify(event));
	return caseOf(name, input, budgetEventSchema.safeParse(input));
}

test('performanceBaselineSchema parsed a frozen value with trimmed text and refused a blank unit of measure, an unknown target and a malformed comparison digest', () => {
	const padded = {
		...coldLatency,
		workload: '  cold parse of a ledger line  ',
		method: '  median of timed rounds  '
	};
	const accepted = parsePerformance(
		'a frozen latency value with padded workload and method text',
		padded
	);
	const blankUnit = parsePerformance('a unit of measure that is only spaces', {
		...coldLatency,
		unitOfMeasure: '   '
	});
	const unknownTarget = parsePerformance('a target that is not a runtime kind', {
		...coldLatency,
		target: 'container'
	});
	const badDigest = parsePerformance('a comparison whose request is not a sha256 hex digest', {
		...coldLatency,
		comparison: { ...comparison, request: 'NOT-A-DIGEST' }
	});
	expect(accepted.output).toEqual({
		...coldLatency,
		workload: 'cold parse of a ledger line',
		method: 'median of timed rounds'
	});
	expect(blankUnit.error).toEqual([expect.stringContaining('unitOfMeasure:')]);
	expect(unknownTarget.error).toEqual([expect.stringContaining('target:')]);
	expect(badDigest.error).toEqual(['comparison.request: must be a sha256 hex digest']);
	recordExampleCases(
		{
			unitId: 'function.budget-types',
			symbol: 'performanceBaselineSchema',
			state: 'performancebaselineschema-parsed-a-frozen-value-with-trimmed',
			evidence: 'examples-cases',
			file: 'performancebaselineschema-parsed-a-frozen-value-with-trimmed.json'
		},
		[accepted, blankUnit, unknownTarget, badDigest]
	);
});

test('budgetEventSchema parsed a baseline with a performance value and an approval with before and after limits and an unmeasured metric', () => {
	const frozen = readEvent('a baseline that froze two metrics and one performance value', baseline);
	const reviewed = readEvent(
		'an approval with before and after limits, an unmeasured metric and no performance value',
		approval
	);
	expect(frozen.output).toEqual(baseline);
	expect(reviewed.output).toEqual(approval);
	recordExampleCases(
		{
			unitId: 'function.budget-types',
			symbol: 'budgetEventSchema',
			state: 'budgeteventschema-parsed-a-baseline-with-a-performance-value',
			evidence: 'examples-cases',
			file: 'budgeteventschema-parsed-a-baseline-with-a-performance-value.json'
		},
		[frozen, reviewed]
	);
});

test('budgetEventSchema refused a unit id that is not an identifier, an uppercase record commit, an unknown type and an approval without after limits', () => {
	const badUnit = readEvent('a unit id with a space and capital letters', {
		...baseline,
		unit: 'Function Budget'
	});
	const upperCommit = readEvent('a record commit written in uppercase hex', {
		...baseline,
		record: { ...signed.record, commit: commit.toUpperCase() }
	});
	const unknownType = readEvent('a type other than baseline or approval', {
		...baseline,
		type: 'waiver'
	});
	const noAfter = readEvent('an approval that states no after limits', {
		...approval,
		after: undefined
	});
	expect(badUnit.error).toEqual([expect.stringContaining('unit: Invalid string: must match')]);
	expect(upperCommit.error).toEqual([
		'record.commit: Invalid string: must match pattern /^[0-9a-f]{40}$/'
	]);
	expect(unknownType.error).toEqual([
		expect.stringContaining("type: Invalid discriminator value. Expected 'baseline' | 'approval'")
	]);
	expect(noAfter.error).toEqual(['after: Invalid input: expected record, received undefined']);
	recordExampleCases(
		{
			unitId: 'function.budget-types',
			symbol: 'budgetEventSchema',
			state: 'budgeteventschema-refused-a-unit-id-that-is-not-an-identifie',
			evidence: 'examples-cases',
			file: 'budgeteventschema-refused-a-unit-id-that-is-not-an-identifie.json'
		},
		[badUnit, upperCommit, unknownType, noAfter]
	);
});
