import { expect, test } from 'vitest';
import { observedTaskOperation } from '../../../../test/support/taskProfiles';
import { hubNotes } from '../../src/services/hub-evidence-service/hubNotes';
import { evidenceFixture, sourceAt } from '../support/evidenceFixture';
import { verification } from '../support/evidenceRecords';

const kinds = (note: { entries: Array<{ kind: string }> } | undefined) =>
	note?.entries.map((entry) => entry.kind);
const blobs = (calls: string[]) => calls.filter((call) => call.startsWith('blob ')).length;

test('the notes of a pinned commit are read for each commit, whatever directories name it', async () => {
	const f = evidenceFixture();
	const { root, changed, tip } = f.commits;
	const base = await sourceAt(f, changed);
	const notes = await observedTaskOperation(
		'hub.function.hub-notes',
		'read-pinned-synthetic-git-notes',
		() => hubNotes(base, f.pins.notesRevision)
	);
	const paths = [...(f.git.commits.get(f.pins.notesRevision)?.files.keys() ?? [])];
	expect(paths.map((path) => path.includes('/')).sort()).toEqual([false, true]);
	expect([...notes.keys()].sort()).toEqual([root, changed].sort());
	expect(kinds(notes.get(changed))).toEqual(['verification', 'reason']);
	expect(notes.get(root)).toMatchObject({
		entries: [{ record: f.records.first.record.id, evidence: f.pointers.first }],
		problems: []
	});
	expect(notes.has(tip)).toBe(false);
});

test('notes that moved since do not change what a pinned commit holds, and none means none', async () => {
	const f = evidenceFixture();
	const base = await sourceAt(f, f.commits.changed);
	const pinned = f.pins.notesRevision;
	const earlier = f.git.commits.get(pinned)?.parents[0] as string;
	f.noteLater();
	expect(kinds((await hubNotes(base, pinned)).get(f.commits.changed))).toHaveLength(2);
	expect([...(await hubNotes(base, earlier)).keys()]).toEqual([f.commits.root]);
	expect((await hubNotes(base, null)).size).toBe(0);
});

test('a line that is not an entry, or was written for another commit, is reported and not used', async () => {
	const f = evidenceFixture();
	const { tip, changed } = f.commits;
	const copied = verification(f.records.first, f.pointers.first);
	const broken = { schemaVersion: 1, kind: 'verification' } as unknown as typeof copied;
	const notes = await hubNotes(await sourceAt(f, changed), f.store.note(tip, [copied, broken]));
	expect(notes.get(tip)?.entries).toEqual([]);
	expect(notes.get(tip)?.problems).toEqual([
		`note line 1 was written for commit ${f.commits.root}, not this commit`,
		'note line 2 is not a valid history entry'
	]);
});

test('the notes of one pinned commit are read from the source once', async () => {
	const f = evidenceFixture();
	const base = await sourceAt(f, f.commits.changed);
	const first = await hubNotes(base, f.pins.notesRevision);
	const read = blobs(f.calls);
	expect(read).toBe(2);
	expect(await hubNotes(base, f.pins.notesRevision)).toEqual(first);
	expect(blobs(f.calls)).toBe(read);
});
