import { measureWorkload } from '../../../../test/support/measureWorkload';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { artifactLimit } from '../../../desktop/src/utils/artifactMedia';
import {
	asked,
	bound,
	bytesOf,
	evidenceFixture,
	other,
	outsider,
	read,
	refusal,
	type EvidenceFixture
} from '../support/evidenceFixture';
import { clock, png, sha256 } from '../support/evidenceRecords';

const shot = 'captures/titles-default-desktop.png';
const tipOf = (f: EvidenceFixture) => asked(f.commits.changed, 'verified', 'current');
const within = (f: EvidenceFixture, entity?: string) =>
	asked(f.commits.changed, 'main', 'commit', entity);

test('the bytes of a listed capture are answered with their hash and attested type', () =>
	measureWorkload('hub.service.hub-evidence', 'listed-artifact-read', async () => {
		const f = evidenceFixture();
		const shown = await read(f, within(f));
		for (const side of ['after', 'before'] as const) {
			const query = bound(shown, within(f), side);
			const stored = f.records[side === 'after' ? 'second' : 'first'].files.get(shot);
			const found = await bytesOf(f, query);
			expect(found).toMatchObject({ mediaType: 'image/png', sha256: query.sha256 });
			expect(found.bytes).toEqual(stored);
		}
		expect(bound(shown, within(f), 'before').recordId).toBe(f.records.first.record.id);
	}));

test('an inherited capture is read from the record that produced it', async () => {
	const f = evidenceFixture();
	const shown = await read(f, within(f, clock));
	const query = bound(shown, within(f, clock));
	expect(query.recordId).toBe(f.records.second.record.id);
	const found = await bytesOf(f, query);
	expect(new TextDecoder().decode(found.bytes)).toBe('tick\n');
	expect(found.mediaType).toBe('text/plain; charset=utf-8');
});

test('a capture of another entity, record, side or hash is not listed and not read', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, within(f)), within(f));
	const kept = bound(await read(f, within(f, clock)), within(f, clock));
	const { scenarioId, state, evidenceId, viewport } = kept;
	const foreign = { ...query, scenarioId, state, evidenceId, viewport, sha256: kept.sha256 };
	const refused = [
		foreign,
		{ ...query, sha256: 'a'.repeat(64) },
		{ ...query, recordId: f.records.first.record.id },
		{ ...query, side: 'before' as const },
		{ ...query, viewport: null },
		{ ...query, state: 'empty' }
	];
	for (const attempt of refused)
		expect(await refusal(bytesOf(f, attempt))).toBe('artifact-refused');
	expect((await bytesOf(f, query)).sha256).toBe(query.sha256);
});

test('a capture is never answered for another project', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	const elsewhere = { ...query, projectId: other.id };
	expect(await refusal(bytesOf(f, elsewhere))).toBe('evidence-stale');
	const unpinned = { ...elsewhere, notesRevision: null, evidenceRevision: null };
	expect(await refusal(bytesOf(f, unpinned))).toBe('artifact-refused');
	expect(await refusal(bytesOf(f, query, outsider))).toBe('forbidden');
	expect(await refusal(bytesOf(f, elsewhere, outsider))).toBe('forbidden');
});

test('an artifact of exactly 11 MiB is read, and one byte more is refused as too large', async () => {
	const most = evidenceFixture({ screens: png('most', artifactLimit) });
	const query = bound(await read(most, tipOf(most)), tipOf(most));
	expect((await bytesOf(most, query)).bytes).toHaveLength(artifactLimit);
	const more = evidenceFixture({ screens: png('more', artifactLimit + 1) });
	const shown = await read(more, tipOf(more));
	// It stays listed as stored; only its bytes are not read here.
	expect(shown.evidence.after.captures[0].capture.media).not.toBeNull();
	expect(await refusal(bytesOf(more, bound(shown, tipOf(more))))).toBe('artifact-too-large');
});

test('markup recorded as a screenshot is listed and never served', async () => {
	const markup = new TextEncoder().encode('<html><script>alert(1)</script></html>');
	const f = evidenceFixture({ screens: markup });
	const shown = await read(f, tipOf(f));
	expect(shown.evidence.after.captures[0].capture).toMatchObject({
		kind: 'screenshot',
		mediaType: 'image/png',
		sha256: sha256(markup)
	});
	expect(await refusal(bytesOf(f, bound(shown, tipOf(f))))).toBe('artifact-refused');
});

test('a notes-only update gives new metadata and leaves what was shown readable', async () => {
	const f = evidenceFixture();
	const first = await read(f, tipOf(f));
	const query = bound(first, tipOf(f));
	const notes = f.noteLater();
	const next = await read(f, tipOf(f));
	expect(next.identity.notesRevision).toBe(notes);
	expect(next.identity.notesRevision).not.toBe(first.identity.notesRevision);
	expect(next.identity.evidenceRevision).toBe(first.identity.evidenceRevision);
	expect(next.evidence.after.record?.id).toBe(f.records.later.record.id);
	// The old revisions still answer with the bytes of the record that was shown.
	const found = await bytesOf(f, query);
	expect(found.bytes).toEqual(f.records.second.files.get(shot));
	// At the new notes the old record judges nothing: the newer one is never given in its place.
	expect(await refusal(bytesOf(f, { ...query, notesRevision: notes }))).toBe('artifact-refused');
	const later = await bytesOf(f, bound(next, tipOf(f)));
	expect(later.bytes).toEqual(f.records.later.files.get(shot));
});

test('revisions the refs never held are refused, and earlier ones are read as they were', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	const stale = [
		{ ...query, notesRevision: 'f'.repeat(40) },
		{ ...query, notesRevision: null },
		{ ...query, evidenceRevision: null },
		{ ...query, evidenceRevision: f.commits.tip },
		{ ...query, notesRevision: f.pins.evidenceRevision }
	];
	for (const attempt of stale) expect(await refusal(bytesOf(f, attempt))).toBe('evidence-stale');
	// The evidence as it was when the record of the change was added still holds that record.
	const earlier = { ...query, evidenceRevision: f.pointers.second.commit };
	expect((await bytesOf(f, earlier)).sha256).toBe(query.sha256);
	// Before that it did not: the record is not part of that evidence, so nothing is listed.
	const before = { ...query, evidenceRevision: f.pointers.first.commit };
	expect(await refusal(bytesOf(f, before))).toBe('artifact-refused');
});

test('a capture of a view of the tip is refused once the tip is elsewhere', async () => {
	const f = evidenceFixture();
	const query = bound(await read(f, tipOf(f)), tipOf(f));
	f.git.refs.set('refs/heads/verified', f.commits.tip);
	expect(await refusal(bytesOf(f, query))).toBe('evidence-stale');
});
