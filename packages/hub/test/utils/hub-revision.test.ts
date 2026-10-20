import { expect, test } from 'vitest';
import { hubEvidenceRevision } from '../../src/utils/hub-evidence-revision/hubEvidenceRevision';
import { evidenceFixture, sourceAt, type EvidenceFixture } from '../support/evidenceFixture';
import { statusAt } from '../support/evidenceReaders';
import { clock, page, sha256 } from '../support/evidenceRecords';

async function built(f: EvidenceFixture, pins = f.pins) {
	const { changed } = f.commits;
	const base = await sourceAt(f, changed);
	const history = statusAt(f, base, pins);
	return {
		...(await hubEvidenceRevision(base, history, changed)),
		status: await history.status(changed)
	};
}
const media = (f: EvidenceFixture, record: 'first' | 'second', path: string) =>
	`media/${sha256(f.records[record].files.get(path) as Uint8Array)}.${path.split('.').at(-1)}`;

test('a commit is built from its own registry, the records attached to it and its noted reasons', async () => {
	const f = evidenceFixture();
	const { changed, root } = f.commits;
	const { detail, status } = await built(f);
	const [first, second] = [f.records.first.record, f.records.second.record];
	expect(status).toMatchObject({ commit: changed, verified: true });
	expect(detail).toMatchObject({
		commit: changed,
		registry: { available: true },
		comparison: { base: root, record: second.id, scenarios: ['titles-page'] },
		sourceImpact: null,
		explanations: [f.noted.explanation]
	});
	expect(detail.comparison?.units).toEqual({
		direct: [page],
		indirect: [],
		added: [],
		removed: []
	});
	expect(detail.registry.units.map((unit) => unit.id)).toEqual([clock, page]);
	expect(detail.records).toHaveLength(1);
	const [ran, kept] = detail.records[0].scenarios;
	expect(detail.records[0]).toMatchObject({
		id: second.id,
		valid: true,
		problems: []
	});
	expect(ran).toMatchObject({
		inherited: false,
		origin: { record: second.id, commit: changed }
	});
	expect(ran.states[0].captures[0].media).toBe(
		media(f, 'second', 'captures/titles-default-desktop.png')
	);
	// What is inherited names the record and commit that produced it, and the checks it ran there.
	expect(kept).toMatchObject({
		...{ id: 'clock', status: 'referenced', inherited: true },
		origin: { record: first.id, commit: root },
		originTests: [{ id: 'clock:ticks', status: 'passed' }]
	});
	expect(kept.states[0].captures[0].media).toBe(media(f, 'first', 'captures/clock.txt'));
});

test('bytes that are not stored are a stated gap, and an unusable record is still listed', async () => {
	const f = evidenceFixture();
	const notesRevision = f.store.note(f.commits.root, [], true);
	const { detail, status } = await built(f, { ...f.pins, notesRevision });
	const origin = f.records.first.record.id.slice(0, 12);
	expect(status.verified).toBe(false);
	expect(detail.comparison).toBeNull();
	expect(detail.records).toMatchObject([{ valid: false }]);
	const [ran, kept] = detail.records[0].scenarios;
	expect(ran.states[0].captures[0].media).not.toBeNull();
	expect(kept.states[0].captures[0]).toMatchObject({
		media: null,
		gap: `inherited record ${origin} is not available`
	});
	expect(kept.originTests).toBeUndefined();
});

test('a record whose directory cannot be read gives no view of itself', async () => {
	const f = evidenceFixture();
	const { commit, path } = f.pointers.second;
	f.git.commits.get(commit)?.files.delete(`${path}/manifest.json`);
	const { detail, status } = await built(f);
	expect(detail.records).toEqual([]);
	expect(status.records).toMatchObject([
		{
			valid: false,
			problems: ['manifest does not match the hash in the note']
		}
	]);
});
