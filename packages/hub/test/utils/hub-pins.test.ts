import { expect, test } from 'vitest';
import { hubEvidencePins } from '../../src/utils/hubEvidenceScope';
import { evidenceFixture, other, refusal, sourceAt } from '../support/evidenceFixture';

test('revisions a request repeats are kept when each ref is or was there', async () => {
	const f = evidenceFixture();
	const base = await sourceAt(f, f.commits.changed);
	await hubEvidencePins(base, f.pins);
	expect(base.identity).toMatchObject(f.pins);
	const earlier = {
		notesRevision: f.git.commits.get(f.pins.notesRevision)?.parents[0] as string,
		evidenceRevision: f.pointers.first.commit
	};
	await hubEvidencePins(base, earlier);
	expect(base.identity).toMatchObject(earlier);
	// A ref that moved on still holds what it held.
	f.noteLater();
	const moved = await sourceAt(f, f.commits.changed);
	expect(moved.identity.notesRevision).not.toBe(f.pins.notesRevision);
	await hubEvidencePins(moved, f.pins);
	expect(moved.identity).toMatchObject(f.pins);
});

test('a revision its ref never held is refused as stale, and so is none where there is a ref', async () => {
	const f = evidenceFixture();
	const base = await sourceAt(f, f.commits.changed);
	const { notesRevision, evidenceRevision } = f.pins;
	const refused = [
		{ ...f.pins, notesRevision: 'f'.repeat(40) },
		{ ...f.pins, notesRevision: null },
		{ ...f.pins, evidenceRevision: null },
		{ ...f.pins, evidenceRevision: f.commits.changed },
		{ notesRevision: evidenceRevision, evidenceRevision: notesRevision }
	];
	for (const wanted of refused)
		expect(await refusal(hubEvidencePins(base, wanted))).toBe('evidence-stale');
});

test('a repository without the refs is pinned to none, and to nothing else', async () => {
	const f = evidenceFixture();
	const bare = await sourceAt(f, f.commits.changed, other);
	const none = { notesRevision: null, evidenceRevision: null };
	await hubEvidencePins(bare, none);
	expect(bare.identity).toMatchObject(none);
	expect(await refusal(hubEvidencePins(bare, f.pins))).toBe('evidence-stale');
	expect(await refusal(hubEvidencePins(bare, { ...none, evidenceRevision: f.commits.root }))).toBe(
		'evidence-stale'
	);
});
