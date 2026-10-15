import { expect, test } from 'vitest';
import type { Explanation, RequiredReason } from '../../src/core/explanationTypes';
import { ExplanationService } from '../../src/services/ExplanationService';

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
/** A change of one function from a1 to a2, written in two steps through m. */
const change: RequiredReason = {
	unit: 'function.slugify',
	symbol: 'slugify',
	file: 'src/utils/slugify.ts',
	change: 'modified',
	from: 'a1',
	to: 'a2'
};
/** A reason for one step whose first attempt has so many words. */
const step = (from: string, to: string, attempt: number, recordedAt: string): Explanation => ({
	...change,
	from,
	to,
	behavior: `Shouts titles from ${from} to ${to}.`,
	simplification: { attempt: words(attempt), outcome: 'not-improved' },
	performance: { attempt: 'No hot path is touched.', outcome: 'not-applicable' },
	recordedAt
});
const long = 'function.slugify slugify: simplification attempt has 16 words; the limit is 15.';
const service = new ExplanationService();
const short = step('a1', 'm', 15, '2026-10-15T18:00:00.000Z');
const wordy = step('a1', 'm', 16, '2026-10-12T00:00:00.000Z');
const rest = step('m', 'a2', 15, '2026-10-12T00:00:00.000Z');

test('a step written again is held by its later reason inside a chain', () => {
	const told = service.report([change], [wordy, short, rest], 2);
	expect([told.failures, told.overlong, told.entries]).toEqual([[], [], [short, rest]]);
});

test('a later long reason for a step still fails; an earlier short one never settles it', () => {
	// Written last, whatever earlier date it carries: the service orders by what it is given.
	const backdated = { ...wordy, recordedAt: '2026-10-01T00:00:00.000Z' };
	const told = service.report([change], [short, backdated, rest], 2);
	expect([told.failures, told.overlong, told.entries]).toEqual([
		[long],
		[change],
		[backdated, rest]
	]);
});

test('the version the revision declares still decides the length of the step relied on', () => {
	const first = service.report([change], [short, wordy, rest], 1);
	expect([first.failures, first.overlong, first.entries]).toEqual([[], [], [wordy, rest]]);
	const none = service.report([change], [short, wordy, rest], null);
	expect([none.failures, none.overlong, none.entries]).toEqual([[], [], [wordy, rest]]);
});
