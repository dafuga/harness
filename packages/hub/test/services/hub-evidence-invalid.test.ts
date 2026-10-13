import { expect, test } from 'vitest';
import {
	asked,
	bound,
	bytesOf,
	evidenceFixture,
	read,
	refusal,
	type EvidenceFixture
} from '../support/evidenceFixture';
import { clock, json, png, sha256, stored, verification } from '../support/evidenceRecords';

const brief = (id: string) => id.slice(0, 12);
const tipOf = (f: EvidenceFixture) => asked(f.commits.changed, 'verified', 'current');
/** Replaces one file of a commit, as if the repository answered with other bytes. */
function replace(f: EvidenceFixture, commit: string, path: string, bytes: Uint8Array) {
	const files = f.git.commits.get(commit)?.files;
	if (!files?.has(path)) throw new Error(`${path} is not in that commit.`);
	files.set(path, bytes);
}

test('a record whose content is not what its id seals stays listed as invalid', async () => {
	const f = evidenceFixture();
	const { record, files } = f.records.second;
	const broken = stored({ ...record, finishedAt: '2026-10-12T09:30:00Z' }, files);
	const pointer = f.store.add(broken);
	f.store.note(f.commits.changed, [verification(broken, pointer)], true);
	const { scope, evidence } = await read(f, tipOf(f));
	const problem = 'record content does not match its id';
	expect(scope.summary).toMatchObject({
		coverage: 'invalid',
		gaps: [`record ${brief(record.id)}: ${problem}`],
		records: [{ id: record.id, valid: false, problems: [problem] }]
	});
	expect(evidence.after).toMatchObject({
		record: null,
		captures: [],
		gap: 'No record of this commit could be validated.'
	});
	expect(evidence.after.detail?.records).toMatchObject([{ valid: false, problems: [problem] }]);
	expect(evidence.after.coverage.every((item) => item.standing !== 'passed')).toBe(true);
});

test('a manifest that is not the one the note names makes its record unusable', async () => {
	const f = evidenceFixture();
	const { commit, path } = f.pointers.second;
	replace(f, commit, `${path}/manifest.json`, json({ schemaVersion: 1, files: [] }));
	const { scope, evidence } = await read(f, tipOf(f));
	expect(scope.summary.coverage).toBe('invalid');
	expect(scope.summary.records).toMatchObject([
		{ valid: false, problems: ['manifest does not match the hash in the note'] }
	]);
	expect(evidence.after).toMatchObject({ record: null, captures: [] });
});

test('capture bytes that are not the recorded ones never give a usable capture', async () => {
	const f = evidenceFixture();
	const { commit, path } = f.pointers.first;
	replace(f, commit, `${path}/captures/clock.txt`, new TextEncoder().encode('tock\n'));
	const own = await read(f, asked(f.commits.root, 'main', 'commit', clock));
	const problem = 'captures/clock.txt does not match its manifest';
	expect(own.scope.summary.records).toMatchObject([{ valid: false, problems: [problem] }]);
	expect(own.evidence.after).toMatchObject({ record: null, captures: [] });
	// The change inherits the clock from that record, so its own record proves nothing either.
	const later = await read(f, asked(f.commits.changed, 'main', 'commit', clock));
	expect(later.scope.summary.records[0].valid).toBe(false);
	expect(later.scope.summary.records[0].problems.join(' ')).toMatch(
		/is not sound: captures\/clock/
	);
	expect(later.evidence.after.captures).toEqual([]);
});

test('media that the evidence branch points to with another hash is not the recorded media', async () => {
	const f = evidenceFixture();
	const { commit, path } = f.pointers.second;
	const other = png('other');
	const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${sha256(other)}\nsize ${other.length}\n`;
	const file = 'captures/titles-default-desktop.png';
	replace(f, commit, `${path}/${file}`, new TextEncoder().encode(pointer));
	f.git.lfs.set(sha256(other), other);
	const { scope, evidence } = await read(f, tipOf(f));
	expect(scope.summary.records).toMatchObject([
		{ valid: false, problems: [`${file} does not match its manifest`] }
	]);
	expect(evidence.after.captures).toEqual([]);
});

test('a media object that is not its hash is refused and never served', async () => {
	const f = evidenceFixture();
	const shot = f.records.second.files.get('captures/titles-default-desktop.png') as Uint8Array;
	const shown = await read(f, tipOf(f));
	const capture = bound(shown, tipOf(f));
	f.git.lfs.set(sha256(shot), png('swapped', shot.length));
	const fresh = evidenceFixture();
	fresh.git.lfs.set(sha256(shot), png('swapped', shot.length));
	expect(await refusal(read(fresh, tipOf(fresh)))).toBe('cache-hash-mismatch');
	// Metadata keeps attested facts, not every media buffer. A fresh read must reject changed bytes.
	expect(await refusal(bytesOf(f, capture))).toBe('cache-hash-mismatch');
});

test('a pointer outside the pinned evidence is not followed', async () => {
	const f = evidenceFixture();
	const stray = { ...f.pointers.second, commit: f.commits.tip };
	f.store.note(f.commits.changed, [verification(f.records.second, stray)], true);
	const { scope, evidence } = await read(f, tipOf(f));
	const problem = `evidence commit ${brief(f.commits.tip)} is not part of the pinned evidence`;
	expect(scope.summary.records).toMatchObject([{ valid: false, problems: [problem] }]);
	expect(evidence.after).toMatchObject({ record: null, captures: [] });
});

test('a capture of a record that no longer validates is refused', async () => {
	const f = evidenceFixture();
	const shown = await read(f, asked(f.commits.root, 'main', 'commit', clock));
	const capture = bound(shown, asked(f.commits.root, 'main', 'commit', clock));
	expect((await bytesOf(f, capture)).mediaType).toBe('text/plain; charset=utf-8');
	const { commit, path } = f.pointers.first;
	replace(f, commit, `${path}/captures/clock.txt`, new TextEncoder().encode('tock\n'));
	expect(await refusal(bytesOf(f, capture))).toBe('artifact-refused');
});
