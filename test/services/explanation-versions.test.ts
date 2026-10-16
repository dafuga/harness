import { expect, test } from 'vitest';
import type { Explanation, RequiredReason } from '../../src/core/explanationTypes';
import { ExplanationService } from '../../src/services/ExplanationService';

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const change: RequiredReason = {
	unit: 'function.slugify',
	symbol: 'slugify',
	file: 'src/utils/slugify.ts',
	change: 'modified',
	from: 'a1',
	to: 'a2'
};
/** A reason for that exact change whose first attempt has so many words. */
const reason = (attempt: number, recordedAt = '2026-10-12T18:00:00.000Z'): Explanation => ({
	...change,
	behavior: 'Shouts titles.',
	simplification: { attempt: words(attempt), outcome: 'not-improved' },
	performance: { attempt: 'No hot path is touched.', outcome: 'not-applicable' },
	recordedAt
});
const long = (count: number, limit: number) =>
	`function.slugify slugify: simplification attempt has ${count} words; the limit is ${limit}.`;
const service = new ExplanationService();
const failures = (entries: Explanation[], version: 1 | 2 | null) =>
	service.report([change], entries, version).failures;

test('a reason is held to the version of the revision it explains: 15 words under 2, 20 under 1', () => {
	expect(failures([reason(15)], 2)).toEqual([]);
	expect(failures([reason(16)], 2)).toEqual([long(16, 15)]);
	expect(failures([reason(20)], 1)).toEqual([]);
	expect(failures([reason(21)], 1)).toEqual([long(21, 20)]);
	// The same sixteen words are valid where the revision declares the first version.
	expect(failures([reason(16)], 1)).toEqual([]);
});

test('the date a note carries changes nothing: a backdated one is held like a fresh one', () => {
	const before = '2026-10-01T00:00:00.000Z';
	expect(failures([reason(16, before)], 2)).toEqual([long(16, 15)]);
	expect(failures([reason(20, before)], 2)).toEqual([long(20, 15)]);
	expect(failures([reason(20, '2099-01-01T00:00:00.000Z')], 1)).toEqual([]);
});

test('a revision that declares no version fails on no length, and says what is open to a shorter note', () => {
	const sixteen = service.report([change], [reason(16)], null);
	expect([sixteen.failures, sixteen.overlong]).toEqual([[], []]);
	// As before versions: what exceeds the first limits can be replaced, and nothing fails.
	const over = service.report([change], [reason(21)], null);
	expect([over.failures, over.overlong]).toEqual([[], [change]]);
	expect(service.report([change], [reason(16)], 2).overlong).toEqual([change]);
	expect(service.report([change], [reason(16)], 1).overlong).toEqual([]);
});

test('the latest note for the same exact change is the one that is held', () => {
	expect(failures([reason(16), reason(15)], 2)).toEqual([]);
	// A longer one written later, whatever date it carries, is the one relied on.
	expect(failures([reason(15), reason(16, '2026-10-01T00:00:00.000Z')], 2)).toEqual([long(16, 15)]);
});
