import { expect, test } from 'vitest';
import { harnessFailures } from '../../src/components/harness/harness-failures/harnessFailures';

const baseline = 'no baseline is established; a reviewer must establish one';
const units = Array.from({ length: 539 }, (_, index) => `unit.number-${index}`);
// The failures of the first record of a real repository: one test, and every unit unbaselined.
const first = [
	'test test/reports-concurrent-runs.e2e.test.ts failed with exit code 1',
	...units.map((unit) => `${unit}: ${baseline}`)
];

test('hundreds of failures are counted and told by cause, with the first subjects of a shared one', () => {
	const summary = harnessFailures(first);
	expect(summary).toEqual({
		total: 540,
		plain: false,
		causes: [
			{ text: first[0], count: 1, subjects: [] },
			{ text: baseline, count: 539, subjects: units.slice(0, 3) }
		],
		more: 0
	});
	// Nothing is dropped: the counts of the causes add up to every failure.
	expect(summary.causes.reduce((sum, cause) => sum + cause.count, 0)).toBe(first.length);
});

test('a few failures are read as they are, and a failure nothing shares keeps its own words', () => {
	const few = ['function.slugify: source-bytes grew from 103 to 173 without a recorded approval'];
	expect(harnessFailures(few)).toEqual({
		total: 1,
		plain: true,
		causes: [{ text: few[0], count: 1, subjects: [] }],
		more: 0
	});
	expect(harnessFailures([])).toEqual({ total: 0, plain: true, causes: [], more: 0 });
	// The same words about two subjects are one cause; other words about one of them are another.
	const mixed = [
		`a.one: ${baseline}`,
		'a.one: complexity grew from 3 to 4 without a recorded approval',
		'title: check filled failed with exit code 1',
		`a.two: ${baseline}`,
		'a sentence: with a colon in it',
		'no colon at all',
		`a.three: ${baseline}`
	];
	expect(harnessFailures(mixed).causes).toEqual([
		{ text: baseline, count: 3, subjects: ['a.one', 'a.two', 'a.three'] },
		{ text: mixed[1], count: 1, subjects: [] },
		{ text: mixed[2], count: 1, subjects: [] },
		{ text: mixed[4], count: 1, subjects: [] },
		{ text: mixed[5], count: 1, subjects: [] }
	]);
});

test('more causes than fit are counted, not shown as if they were all there', () => {
	const many = Array.from({ length: 9 }, (_, index) => `check ${index} failed in its own way`);
	const summary = harnessFailures(many);
	expect([summary.total, summary.plain, summary.causes.length, summary.more]).toEqual([
		9,
		false,
		5,
		4
	]);
	expect(summary.causes.map((cause) => cause.text)).toEqual(many.slice(0, 5));
});
