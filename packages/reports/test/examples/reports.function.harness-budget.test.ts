import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessBudget } from '../../src/utils/explorer-ui/harnessBudget';
import type {
	Finding,
	Measurement,
	Reviewed
} from '../../src/utils/explorer-ui/harnessBudget.types';

const UNIT = 'reports.function.harness-budget';
const UNREVIEWED = 'freeze declared; no reviewed limit is recorded at this revision';
const NO_RECORD = 'no limit is recorded at this revision';
const NOT_MEASURABLE = 'not frozen: reviewed as not measurable';
const NO_VALUE = 'not frozen: no value to freeze';

function measured(value: number | null, extra: Partial<Measurement> = {}): Measurement {
	return {
		unit: UNIT,
		metric: 'size',
		unitOfMeasure: 'bytes',
		value,
		workload: null,
		profile: null,
		...extra
	};
}

function finding(status: string, baseline: number | null, value: number | null = null): Finding {
	return { unit: UNIT, metric: 'size', status, baseline, measured: value };
}

function record(state: string, cases: Parameters<typeof recordExampleCases>[1]): boolean {
	return recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'harnessBudget',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('an unavailable size is shown as unavailable and not frozen, never as a zero', () => {
	const reason = 'source could not be measured';
	const found = measured(null, { unavailable: reason });
	const withFinding = harnessBudget(found, finding('unavailable', null));
	const withoutFinding = harnessBudget(found);
	expect(withFinding).toEqual({ value: `unavailable: ${reason}`, limit: NOT_MEASURABLE });
	expect(withoutFinding).toEqual({ value: `unavailable: ${reason}`, limit: NO_VALUE });
	expect(withFinding.value).not.toMatch(/^0\b/);
	record('an-unavailable-size-is-shown-as-unavailable-and-not-frozen-never-zero', [
		{
			name: 'unavailable with unavailable finding',
			input: { found, status: 'unavailable' },
			output: withFinding
		},
		{ name: 'unavailable without finding', input: { found }, output: withoutFinding }
	]);
});

test('a counted zero keeps its value and its baseline limit, distinct from unavailable', () => {
	const found = measured(0);
	const withBaseline = harnessBudget(found, finding('passed', 0));
	const unreviewed = harnessBudget(found);
	expect(withBaseline).toEqual({ value: '0 bytes', limit: 'frozen at 0' });
	expect(unreviewed).toEqual({ value: '0 bytes', limit: UNREVIEWED });
	record('a-counted-zero-keeps-its-value-and-its-baseline-limit', [
		{ name: 'zero with baseline zero', input: { found, baseline: 0 }, output: withBaseline },
		{ name: 'zero without finding', input: { found }, output: unreviewed }
	]);
});

test('a partial size adds a note that says what it leaves out', () => {
	const partial = 'generated source only';
	const found = measured(2048, { partial });
	const output = harnessBudget(found, finding('passed', 2048));
	expect(output).toEqual({
		value: '2048 bytes',
		limit: 'frozen at 2048',
		note: `Partial: ${partial}`
	});
	record('a-partial-size-adds-a-note-that-says-what-it-leaves-out', [
		{ name: 'partial value with passed baseline', input: { found, baseline: 2048 }, output }
	]);
});

test('a finding baseline takes priority over the ledger limit', () => {
	const known: Reviewed = { declared: true, limit: 2048 };
	const found = measured(1500);
	const withFinding = harnessBudget(found, finding('passed', 1024), known);
	const ledgerOnly = harnessBudget(found, undefined, known);
	expect(withFinding.limit).toBe('frozen at 1024');
	expect(ledgerOnly.limit).toBe('frozen at 2048');
	record('a-finding-baseline-takes-priority-over-the-ledger-limit', [
		{
			name: 'finding baseline beats ledger limit',
			input: { found, known, baseline: 1024 },
			output: withFinding
		},
		{ name: 'ledger limit alone without finding', input: { found, known }, output: ledgerOnly }
	]);
});

test('a ledger limit applies when this revision has no measurement', () => {
	const known: Reviewed = { declared: true, limit: 2048 };
	const output = harnessBudget(undefined, undefined, known);
	expect(output).toEqual({ value: 'not measured at this revision', limit: 'frozen at 2048' });
	record('a-ledger-limit-applies-when-this-revision-has-no-measurement', [
		{ name: 'missing measurement with ledger limit', input: { known }, output }
	]);
});

test('a missing measurement is shown as not measured, never as zero', () => {
	const unreviewed = harnessBudget(undefined);
	const undeclared = harnessBudget(undefined, undefined, { declared: false });
	expect(unreviewed).toEqual({ value: 'not measured at this revision', limit: UNREVIEWED });
	expect(undeclared).toEqual({ value: 'not measured at this revision', limit: NO_RECORD });
	expect(unreviewed.value).not.toMatch(/0/);
	record('a-missing-measurement-is-shown-as-not-measured-never-as-zero', [
		{ name: 'missing measurement, declared', input: { found: undefined }, output: unreviewed },
		{
			name: 'missing measurement, undeclared',
			input: { known: { declared: false } },
			output: undeclared
		}
	]);
});

test('a declared freeze without a reviewed number states that no limit is recorded', () => {
	const found = measured(2048);
	const declared = harnessBudget(found);
	const undeclared = harnessBudget(found, undefined, { declared: false });
	const noBaseline = harnessBudget(found, finding('missing-baseline', null));
	expect(declared).toEqual({ value: '2048 bytes', limit: UNREVIEWED });
	expect(undeclared.limit).toBe(NO_RECORD);
	expect(noBaseline.limit).toBe(UNREVIEWED);
	record('a-declared-freeze-without-a-reviewed-number-states-that-no-limit-is-recorded', [
		{ name: 'declared freeze, no number', input: { found }, output: declared },
		{
			name: 'undeclared freeze, no number',
			input: { found, known: { declared: false } },
			output: undeclared
		},
		{
			name: 'missing baseline finding',
			input: { found, status: 'missing-baseline' },
			output: noBaseline
		}
	]);
});

test('an exceeded size adds a growth note only when its baseline is present', () => {
	const found = measured(2048);
	const withBaseline = harnessBudget(found, finding('exceeded', 1024, 2048));
	const withoutBaseline = harnessBudget(found, finding('exceeded', null, 2048));
	expect(withBaseline).toEqual({
		value: '2048 bytes',
		limit: 'frozen at 1024',
		note: 'Grew from 1024 to 2048 without a recorded approval.'
	});
	expect(withoutBaseline).toEqual({ value: '2048 bytes', limit: UNREVIEWED });
	expect('note' in withoutBaseline).toBe(false);
	record('an-exceeded-size-adds-a-growth-note-only-when-its-baseline-is-present', [
		{ name: 'exceeded with baseline', input: { found, baseline: 1024 }, output: withBaseline },
		{ name: 'exceeded without baseline', input: { found, baseline: null }, output: withoutBaseline }
	]);
});

test('an unmeasured ledger marker says the size is not frozen while keeping its value', () => {
	const known: Reviewed = { declared: true, unmeasured: 'metric could not be measured' };
	const found = measured(7);
	const output = harnessBudget(found, undefined, known);
	expect(output).toEqual({ value: '7 bytes', limit: NOT_MEASURABLE });
	record('an-unmeasured-ledger-marker-says-the-size-is-not-frozen-while-keeping-its-value', [
		{ name: 'unmeasured ledger marker with value', input: { found, known }, output }
	]);
});

test('a null value without a reason is unavailable and not frozen, not zero', () => {
	const found = measured(null);
	const output = harnessBudget(found);
	expect(output).toEqual({ value: 'unavailable: no reason recorded', limit: NO_VALUE });
	expect(output.value).not.toBe('0 bytes');
	record('a-null-value-without-a-reason-is-unavailable-and-not-frozen-not-zero', [
		{ name: 'null value without reason', input: { found }, output }
	]);
});
