import { expect, test } from 'vitest';
import { evidenceFixture, sourceAt } from '../support/evidenceFixture';
import { statusAt } from '../support/evidenceReaders';
import { verification } from '../support/evidenceRecords';

const brief = (id: string) => id.slice(0, 12);

test('a commit is verified by a passing record that is intact with all it inherits', async () => {
	const f = evidenceFixture();
	const { changed, tip } = f.commits;
	const history = statusAt(f, await sourceAt(f, changed));
	const { record } = f.records.second;
	expect(await history.status(changed)).toEqual({
		commit: changed,
		verified: true,
		records: [
			{
				record: record.id,
				status: 'passed',
				valid: true,
				problems: [],
				evidence: f.pointers.second
			}
		],
		problems: []
	});
	expect(await history.status(tip)).toEqual({
		commit: tip,
		verified: false,
		records: [],
		problems: []
	});
	const lines = await history.verifications();
	expect(lines.map((line) => line.record).sort()).toEqual(
		[f.records.first.record.id, record.id].sort()
	);
});

test('a record is unproven when what it inherits from is not attached anywhere', async () => {
	const f = evidenceFixture();
	const { changed, root } = f.commits;
	const notesRevision = f.store.note(root, [], true);
	const history = statusAt(f, await sourceAt(f, changed), { ...f.pins, notesRevision });
	const origin = brief(f.records.first.record.id);
	const status = await history.status(changed);
	expect(status.verified).toBe(false);
	expect(status.records).toMatchObject([
		{
			valid: false,
			problems: [
				`base record ${origin} is not available`,
				`scenario clock is inherited from record ${origin}, which is not available`
			]
		}
	]);
});

test('a record must be the one its note names, for the commit and tree that exist', async () => {
	const f = evidenceFixture();
	const { changed, tip } = f.commits;
	const line = verification(f.records.second, f.pointers.second);
	const twice = f.store.note(changed, [line]);
	const base = await sourceAt(f, changed);
	const history = statusAt(f, base, { ...f.pins, notesRevision: twice });
	// A line that is noted twice is one record.
	expect((await history.status(changed)).records).toHaveLength(1);
	const moved = { ...line, source: { ...line.source, commit: tip } };
	const other = f.store.note(tip, [{ ...moved, record: 'another', status: 'failed' }]);
	const copied = statusAt(f, base, { ...f.pins, notesRevision: other });
	expect((await copied.status(tip)).records).toMatchObject([
		{
			record: 'another',
			status: 'failed',
			valid: false,
			problems: [
				'record is not the one the note names',
				`record is for commit ${changed}, not ${tip}`,
				'record tree does not match the commit tree',
				'record outcome differs from the note'
			]
		}
	]);
});
