import { expect, test } from 'vitest';
import type { Evidence } from '../../src/models/Report.types';
import { audioPairs } from '../../src/utils/audioPairs';
import { galleryEvidence, reportFilter } from '../../src/utils/reportFilter';
const before: Evidence = {
	id: 'before',
	title: 'Early recording',
	category: 'Voice',
	file: 'before.wav',
	mediaType: 'audio',
	status: 'failed',
	phase: 'before',
	comparison: 'voice',
	source: 'Unique microphone source',
	viewport: 'desktop'
};
const after: Evidence = {
	...before,
	id: 'after',
	file: 'after.wav',
	title: 'Later recording',
	phase: 'after',
	source: 'Later source',
	status: 'passed'
};
test('pairs exactly one Before and After audio in the same comparison and viewport', () => {
	const items = [before, after];
	expect(galleryEvidence(items)).toEqual([after]);
	expect(audioPairs(items).get('after')).toEqual(before);
	expect(
		reportFilter(
			galleryEvidence(items),
			{
				search: 'Unique microphone',
				category: '',
				phase: '',
				status: 'failed'
			},
			audioPairs(items)
		)
	).toEqual([after]);
});
test('unpaired, ambiguous, different-viewport and cross-media audio are never hidden', () => {
	for (const other of [
		{ ...after, viewport: 'mobile' },
		{ ...after, comparison: '' },
		{ ...after, mediaType: 'image' as const, file: 'after.png' }
	]) {
		expect(audioPairs([before, other]).size).toBe(0);
		expect(galleryEvidence([before, other])).toContainEqual(before);
	}
	const ambiguous = [before, { ...before, id: 'duplicate' }, after];
	expect(audioPairs(ambiguous).size).toBe(0);
	expect(galleryEvidence(ambiguous)).toHaveLength(3);
	expect(galleryEvidence([before])).toEqual([before]);
});
test('missing audio stays in its pair and original objects and statuses are unchanged', () => {
	const unavailable = { ...before, missing: true, status: 'not-proven' as const };
	const original = structuredClone([unavailable, after]);
	expect(audioPairs([unavailable, after]).get('after')).toBe(unavailable);
	expect([unavailable, after]).toEqual(original);
});
