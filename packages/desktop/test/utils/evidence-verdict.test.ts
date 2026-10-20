import { expect, test } from 'vitest';
import type { EvidenceStatus } from '../../src/utils/evidenceNotice';
import { readingEvidence, unavailableEvidence } from '../../src/utils/evidenceNotice';
import { evidenceVerdict } from '../../src/components/entity-view/evidenceVerdict';
import { commits, data, entityOf, ids } from '../evidence-fixture';

const read = (id: string, mode: string, commit = commits.tip) => ({
	status: 'ready' as EvidenceStatus,
	result: structuredClone(data.results[`${id}|${mode}|${commit}`]),
	error: ''
});
const without = (status: EvidenceStatus, error = '') => ({ status, result: null, error });
const catalog = { status: 'unverified', reason: 'No verification recorded for this revision.' };

test('a record that proves the entity is a passed verdict, in the words of the explorer', () => {
	const shown = evidenceVerdict(read(ids.filter, 'current'), entityOf(ids.filter), commits.tip);
	expect(shown).toEqual({ status: 'verified', reason: 'Full coverage passed' });
});

test('what the record does not prove fails with its reasons; a commit without a record is unknown', () => {
	const page = evidenceVerdict(read(ids.page, 'current'), entityOf(ids.page), commits.tip);
	expect(page.status).toBe('failed');
	expect(page.reason).toMatch(/^Verification failed: /);
	const uncovered = evidenceVerdict(
		read(ids.settings, 'current'),
		entityOf(ids.settings),
		commits.tip
	);
	expect(uncovered).toEqual({
		status: 'failed',
		reason:
			'Coverage incomplete: No scenario covers this unit; tests alone do not show how it behaves.'
	});
	const first = read(ids.page, 'commit', commits.first);
	expect(evidenceVerdict(first, entityOf(ids.page), commits.first)).toEqual({
		status: 'unknown',
		reason: 'Evidence missing: No verification record is attached to this commit.'
	});
});

test('evidence of another commit, or one that does not hold the entity, judges nothing', () => {
	const entity = entityOf(ids.filter);
	const other = evidenceVerdict(read(ids.filter, 'current'), entity, commits.middle);
	expect(other).toEqual({ status: 'unknown', reason: readingEvidence });
	const stripped = read(ids.filter, 'current');
	stripped.result.evidence.after.detail!.registry.units = [];
	expect(evidenceVerdict(stripped, entity, commits.tip)).toEqual({
		status: 'unknown',
		reason: 'The evidence that was read does not hold this entity, so it is not judged here.'
	});
	const absent = read(ids.filter, 'current');
	Object.assign(absent.result.evidence.after, { detail: null, gap: 'Revision ccccccc is gone.' });
	expect(evidenceVerdict(absent, entity, commits.tip)).toEqual({
		status: 'unknown',
		reason: 'Revision ccccccc is gone.'
	});
});

test('while nothing was read the catalog is repeated; reading, absence and failure are said', () => {
	const entity = entityOf(ids.page);
	expect(evidenceVerdict(without('idle'), entity, commits.tip)).toEqual(catalog);
	expect(evidenceVerdict(without('planned'), entity, commits.tip)).toEqual(catalog);
	expect(evidenceVerdict(without('loading'), entity, commits.tip)).toEqual({
		status: 'unknown',
		reason: readingEvidence
	});
	expect(evidenceVerdict(without('unavailable'), entity, commits.tip)).toEqual({
		status: 'unknown',
		reason: unavailableEvidence
	});
	expect(evidenceVerdict(without('failed', 'forbidden'), entity, commits.tip)).toEqual({
		status: 'unknown',
		reason: 'Recorded evidence could not be read: forbidden'
	});
});
