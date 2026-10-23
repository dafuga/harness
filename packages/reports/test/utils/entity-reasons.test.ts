import { expect, test } from 'vitest';
import { writingCount, writingLimits } from '../../../../src/utils/writing-limits/writingLimits';
import type { HarnessExplanation } from '../../src/models/Harness.types';
import { boundedText, entityReasons } from '../../src/utils/entityReasons';
import { reasonsTried } from '../../src/components/explorer-ui/entity-history-row/entityReasons';
import { reasonUses } from '../../src/components/explorer-ui/entity-reasons/entityReasons';

const unchanged = 'Registration only; implementation unchanged.';
const reason = (symbol: string, changed: Partial<HarnessExplanation> = {}): HarnessExplanation => ({
	unit: 'app.function.cpu-client',
	symbol,
	file: 'src/utils/cpuClient.ts',
	change: 'modified',
	behavior: `${symbol} reads one sample.`,
	simplification: { attempt: unchanged, outcome: 'not-applicable' },
	performance: { attempt: unchanged, outcome: 'not-applicable' },
	...changed
});
const long = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
const within = (text: string, limit: { words: number | null; characters: number }) => {
	const { words, characters } = writingCount(text);
	return (limit.words === null || words <= limit.words) && characters <= limit.characters;
};

test('a text within the shared limit is shown whole and is not marked as cut', () => {
	expect(boundedText(['Register the client as a unit.'], writingLimits.behavior)).toEqual({
		text: 'Register the client as a unit.',
		cut: false
	});
	expect(boundedText([], writingLimits.behavior)).toEqual({ text: '', cut: false });
	// Exactly the limit is not over it.
	const most = Array.from({ length: 30 }, () => 'four').join(' ');
	expect(boundedText([most], writingLimits.behavior)).toEqual({ text: most, cut: false });
});

test('a longer text is cut at a word to the shared limit, and says that it was', () => {
	const shown = boundedText([long], writingLimits.behavior);
	expect(shown.cut).toBe(true);
	expect(within(shown.text, writingLimits.behavior)).toBe(true);
	expect(shown.text.endsWith(' …')).toBe(true);
	// It ends on a whole word of the original, not in the middle of one.
	expect(long.startsWith(shown.text.slice(0, -2))).toBe(true);
	expect(long[shown.text.length - 2]).toBe(' ');
	// One word over the limit is already cut.
	const over = Array.from({ length: 31 }, () => 'four').join(' ');
	expect(boundedText([over], writingLimits.behavior).cut).toBe(true);
});

test('one giant token is cut by characters, which the word limit alone would let through', () => {
	const shown = boundedText(['x'.repeat(900)], writingLimits.attempt);
	expect(shown.cut).toBe(true);
	expect([...shown.text].length).toBe(writingLimits.attempt.characters);
	// A character outside the basic plane counts once, and is never cut in half.
	const wide = boundedText(['𝒳'.repeat(900)], writingLimits.attempt);
	expect([...wide.text].length).toBe(writingLimits.attempt.characters);
	expect(wide.text.endsWith('𝒳…')).toBe(true);
});

test('several notes are bounded together, not each to the limit and then joined', () => {
	const notes = ['alpha', 'beta', 'gamma', 'delta'].map((name) => `${name} ${long}`);
	const shown = boundedText(notes, writingLimits.behavior);
	expect(within(shown.text, writingLimits.behavior)).toBe(true);
	expect(shown.cut).toBe(true);
	// Short notes that fit together are all said; the same note of several functions once.
	expect(boundedText(['One.', 'Two.'], writingLimits.behavior)).toEqual({
		text: 'One. Two.',
		cut: false
	});
	expect(
		boundedText(['Same note.', 'Same note.', ' Same\nnote. '], writingLimits.behavior)
	).toEqual({
		text: 'Same note.',
		cut: false
	});
});

test('the reasons of a change are summarised to the length of one reason', () => {
	const found = entityReasons([
		reason('cpuSample', { behavior: long }),
		reason('cpuClient'),
		reason('cpuGroups', {
			performance: { attempt: 'Cached the sample for a second.', outcome: 'improved' }
		})
	]);
	expect(within(found.behavior.text, writingLimits.behavior)).toBe(true);
	expect(within(found.simplification.text, writingLimits.attempt)).toBe(true);
	expect(within(found.performance.text, writingLimits.attempt)).toBe(true);
	expect(found.behavior.cut).toBe(true);
	expect(found.long).toBe(true);
	expect(found.simplification).toEqual({
		text: unchanged,
		cut: false,
		outcomes: ['not applicable']
	});
	expect(found.performance).toEqual({
		text: `${unchanged} Cached the sample for a second.`,
		cut: false,
		outcomes: ['not applicable', 'improved']
	});
});

test('every original is kept beside the summary, as it was written and about what', () => {
	const found = entityReasons([
		reason('cpuSample', { behavior: long }),
		reason('cpuClient'),
		reason('*', { behavior: 'cpuClient reads one sample.' })
	]);
	expect(found.notes).toEqual([
		{ behavior: long, subjects: ['cpu sample'] },
		{ behavior: 'cpuClient reads one sample.', subjects: ['cpu client', 'the whole entity'] }
	]);
	// No file of the source is part of what is shown.
	expect(JSON.stringify(found)).not.toContain('src/utils');
});

test('an attempt several functions share is listed once, with the outcome it had for each', () => {
	const found = entityReasons([
		reason('cpuSample'),
		reason('cpuClient', { simplification: { attempt: unchanged, outcome: 'improved' } })
	]);
	expect(found.attempted).toEqual([
		{
			attempt: unchanged,
			uses: [
				{ subject: 'cpu sample', kind: 'simplification', outcome: 'not applicable' },
				{ subject: 'cpu sample', kind: 'performance', outcome: 'not applicable' },
				{ subject: 'cpu client', kind: 'simplification', outcome: 'improved' },
				{ subject: 'cpu client', kind: 'performance', outcome: 'not applicable' }
			]
		}
	]);
	expect(found.simplification).toEqual({
		text: unchanged,
		cut: false,
		outcomes: ['not applicable', 'improved']
	});
	// What a row of a history says was tried: the same attempt once, not once for each kind.
	expect(reasonsTried(found)).toEqual([unchanged]);
	expect(found.long).toBe(true);
});

test('one short reason needs no disclosure, and no reason is no summary', () => {
	const one = entityReasons([
		reason('cpuSample', { performance: { attempt: 'Reads the sample once.', outcome: 'improved' } })
	]);
	expect(one.long).toBe(false);
	expect(reasonsTried(one)).toEqual([unchanged, 'Reads the sample once.']);
	const none = { text: '', cut: false };
	expect(entityReasons([])).toEqual({
		behavior: none,
		simplification: { ...none, outcomes: [] },
		performance: { ...none, outcomes: [] },
		notes: [],
		attempted: [],
		long: false
	});
	expect(reasonsTried(entityReasons([]))).toEqual([]);
});

test('the uses of an attempt are told by kind and outcome, each subject under the one it had', () => {
	const [tried] = entityReasons([
		reason('cpuSample'),
		reason('cpuClient', { simplification: { attempt: unchanged, outcome: 'improved' } })
	]).attempted;
	expect(reasonUses(tried.uses)).toEqual([
		{ kind: 'simplification', outcome: 'not applicable', subjects: ['cpu sample'] },
		{ kind: 'performance', outcome: 'not applicable', subjects: ['cpu sample', 'cpu client'] },
		{ kind: 'simplification', outcome: 'improved', subjects: ['cpu client'] }
	]);
});

test('a row says an attempt both kinds share once, and each kind is still held to its limit', () => {
	const found = entityReasons([
		reason('cpuSample'),
		reason('cpuHistory', {
			performance: { attempt: `Sampled once a second instead of ${long}.`, outcome: 'improved' }
		})
	]);
	const tried = reasonsTried(found);
	expect(tried).toHaveLength(2);
	expect(tried[0]).toBe(unchanged);
	expect(tried[1].startsWith('Sampled once a second')).toBe(true);
	expect(within(tried[1], writingLimits.attempt)).toBe(true);
});
