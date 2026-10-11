import { expect, test } from 'vitest';
import { harnessBudget } from '../../src/utils/harnessBudget';

const base = { unit: 'kernel.counter', workload: null, profile: null };
const measured = (value: number | null, extra: object = {}) => ({
	...base,
	metric: 'complexity',
	unitOfMeasure: 'points',
	value,
	...extra
});
const finding = (status: string, baseline: number | null) => ({
	unit: 'kernel.counter',
	metric: 'complexity',
	status,
	baseline,
	measured: null
});

test('a metric that cannot be measured reads as unavailable and not frozen, never as zero', () => {
	const reason = 'Decision points are not counted in Rust: crates/counter/src/lib.rs.';
	const line = harnessBudget(measured(null, { unavailable: reason }), finding('unavailable', null));
	expect(line).toEqual({
		value: `unavailable: ${reason}`,
		limit: 'not frozen: reviewed as not measurable'
	});
	expect(harnessBudget(measured(null, { unavailable: reason })).limit).toBe(
		'not frozen: no value to freeze'
	);
});

test('a counted zero is a value with a limit, and a partial value says what it leaves out', () => {
	expect(harnessBudget(measured(0), finding('passed', 0))).toEqual({
		value: '0 points',
		limit: 'frozen at 0'
	});
	const partial = 'Counted in 1 of 2 code files. Decision points are not counted in Rust: lib.rs.';
	expect(harnessBudget(measured(3, { partial }), finding('passed', 3))).toEqual({
		value: '3 points',
		limit: 'frozen at 3',
		note: `Partial: ${partial}`
	});
	expect(harnessBudget(undefined)).toEqual({
		value: 'not measured at this revision',
		limit: 'frozen'
	});
});
