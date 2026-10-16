import { expect, test } from 'vitest';
import { verificationNoteIdentity } from '../../src/utils/verificationNoteIdentity';
import { verificationSample } from '../support/verificationSample';
import type { HistoryNote } from '../../src/core/historyTypes';

test('the sealed record, actual tree and complete note must state one identity', () => {
	const record = verificationSample();
	const note: Extract<HistoryNote, { kind: 'verification' }> = {
		schemaVersion: 1,
		kind: 'verification',
		record: record.id,
		status: record.status,
		profile: record.profile.id,
		finishedAt: record.finishedAt,
		source: { ...record.source },
		evidence: { commit: 'a'.repeat(40), path: 'records/fixture', manifest: 'b'.repeat(64) }
	};
	expect(verificationNoteIdentity(record, note, record.source.tree)).toEqual([]);
	const changed = { ...note, source: { ...note.source } };
	changed.source.tree = 'e'.repeat(40);
	changed.source.base = 'f'.repeat(40);
	changed.profile = 'another-profile';
	changed.finishedAt = '2020-01-01T00:00:00Z';
	expect(verificationNoteIdentity(record, changed, record.source.tree)).toEqual([
		'note tree differs from the record',
		'note base differs from the record',
		'note profile differs from the record',
		'note finish time differs from the record'
	]);
	expect(verificationNoteIdentity(record, note, null)).toContain(
		'record tree does not match the commit tree'
	);
});
