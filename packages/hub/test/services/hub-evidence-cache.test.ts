import { expect, test } from 'vitest';
import {
	asked,
	colleague,
	evidenceFixture,
	objectReads,
	read,
	refusal,
	type EvidenceFixture
} from '../support/evidenceFixture';
import { sourceFiles, verification } from '../support/evidenceRecords';

const tipOf = (f: EvidenceFixture) => asked(f.commits.changed, 'verified', 'current');
const objects = (f: EvidenceFixture) => objectReads(f.calls).length;

test('an identical read is answered again without reading any object of the source', async () => {
	const f = evidenceFixture();
	const first = await read(f, tipOf(f));
	const before = objects(f);
	expect(before).toBeGreaterThan(0);
	expect(await read(f, tipOf(f))).toEqual(first);
	expect(objects(f)).toBe(before);
	// The refs and the tip are still asked of the source before the cache is believed.
	expect(f.calls.slice(-6).join(' ')).toMatch(/branches/);
});

test('what one person read is not served to another, and a removed member gets nothing', async () => {
	const f = evidenceFixture();
	const first = await read(f, tipOf(f));
	const before = objects(f);
	const shared = await read(f, tipOf(f), colleague);
	expect(shared.identity.principalId).toBe(colleague.id);
	expect(shared.identity.principalId).not.toBe(first.identity.principalId);
	expect({ ...shared, identity: null }).toEqual({ ...first, identity: null });
	expect(objects(f)).toBeGreaterThan(before);
	f.shared.members = f.shared.members.filter((member) => member.actorId !== colleague.id);
	const [calls, reads] = [f.calls.length, f.reads.length];
	expect(await refusal(read(f, tipOf(f), colleague))).toBe('forbidden');
	expect([f.calls.length, f.reads.length]).toEqual([calls, reads]);
});

test('notes or evidence that moved give another identity, and the answer is read again', async () => {
	const f = evidenceFixture();
	const first = await read(f, tipOf(f));
	let before = objects(f);
	const notes = f.noteLater();
	const noted = await read(f, tipOf(f));
	expect(noted.identity).toMatchObject({
		notesRevision: notes,
		evidenceRevision: first.identity.evidenceRevision
	});
	expect(objects(f)).toBeGreaterThan(before);
	before = objects(f);
	const extra = f.store.add(f.records.first);
	const moved = await read(f, tipOf(f));
	expect(moved.identity).toMatchObject({ notesRevision: notes, evidenceRevision: extra.commit });
	expect(objects(f)).toBeGreaterThan(before);
	expect(moved.evidence).toEqual(noted.evidence);
});

test('a commit that stays is answered with the tip its branch has by now', async () => {
	const f = evidenceFixture();
	const query = asked(f.commits.changed, 'main', 'commit');
	expect((await read(f, query)).scope).toMatchObject({ tip: f.commits.tip, atTip: false });
	const next = f.git.commit('next', sourceFiles('next'), [f.commits.tip]);
	f.git.refs.set('refs/heads/main', next);
	expect((await read(f, query)).scope).toMatchObject({ tip: next, atTip: false });
	// The same commit on a branch it is the tip of is another answer, not the cached one.
	const tip = await read(f, asked(f.commits.changed, 'verified', 'commit'));
	expect(tip.scope).toMatchObject({ branch: 'verified', atTip: true });
});

test('a record noted for a commit after it was read is in the next answer', async () => {
	const f = evidenceFixture();
	const empty = await read(f, asked(f.commits.tip, 'main', 'current'));
	expect(empty.scope.summary.coverage).toBe('unverified');
	const line = verification(f.records.first, f.pointers.first);
	f.store.note(f.commits.tip, [{ ...line, source: { ...line.source, commit: f.commits.tip } }]);
	const noted = await read(f, asked(f.commits.tip, 'main', 'current'));
	// The record is of another commit: it is listed as attached here, and proves nothing.
	expect(noted.scope.summary).toMatchObject({ coverage: 'invalid', records: [{ valid: false }] });
	expect(noted.evidence.after.captures).toEqual([]);
});
