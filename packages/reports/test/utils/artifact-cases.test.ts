import { expect, test } from 'vitest';
import { artifactCases, caseForm } from '../../src/utils/artifactCases';
import { calls, compared, elsewhere, gaps, malformed, observed, unit } from '../artifactCaseDocs';

test('recorded calls are read as they were recorded: false, zero, null, an empty list and an error', () => {
	const read = artifactCases(calls, unit);
	expect(read.kind === 'cases' && [read.source, read.symbol]).toEqual([
		'invocations',
		'composeModes'
	]);
	const cases = read.kind === 'cases' ? read.cases : [];
	expect(cases.map((item) => [item.failed, 'output' in item ? item.output : item.error])).toEqual([
		[false, ['comment']],
		[false, []],
		[false, false],
		[false, 0],
		[false, null],
		[true, { name: 'TypeError', message: 'Not a capability' }]
	]);
	expect(artifactCases(calls)).toEqual(read);
});

test('an input and an output at the top are one observation; what was compared is none', () => {
	const read = artifactCases(observed, unit);
	expect(read).toEqual({
		kind: 'cases',
		source: 'observation',
		symbol: null,
		cases: [
			{ name: 'Test observation', input: observed.input, output: observed.output, failed: false }
		]
	});
	for (const document of [
		compared,
		{ actual: 1, expected: 1 },
		{ input: 1 },
		{ output: 1 },
		null,
		7,
		[]
	])
		expect(artifactCases(document, unit)).toEqual({ kind: 'gap', why: gaps.none });
});

test('what is not in the recorded form, or is of another unit, is a gap that says which', () => {
	for (const document of malformed)
		expect(artifactCases(document, unit)).toEqual({ kind: 'gap', why: gaps.malformed });
	expect(artifactCases(elsewhere, unit)).toEqual({ kind: 'gap', why: gaps.elsewhere });
	expect(artifactCases(elsewhere).kind).toBe('cases');
	const most = { ...calls, cases: Array.from({ length: caseForm.most }, () => calls.cases[0]) };
	expect(artifactCases(most, unit).kind).toBe('cases');
});
