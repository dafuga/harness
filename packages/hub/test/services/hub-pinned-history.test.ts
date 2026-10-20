import { expect, test } from 'vitest';
import { hubEvidenceRevision } from '../../src/utils/hub-evidence-revision/hubEvidenceRevision';
import { hubEvidenceOrigin } from '../../src/utils/hubEvidenceViews';
import { statusAt } from '../support/evidenceReaders';
import {
	evidenceFixture,
	refusal,
	sourceAt,
	type EvidenceFixture
} from '../support/evidenceFixture';

const shot = 'captures/titles-default-desktop.png';
const blobs = (f: EvidenceFixture) => f.calls.filter((call) => call.startsWith('blob ')).length;
async function opened(f: EvidenceFixture, pins = f.pins) {
	const base = await sourceAt(f, f.commits.changed);
	return { base, history: statusAt(f, base, pins) };
}

test('a commit is stated as the repository holds it, and ancestry as it is', async () => {
	const f = evidenceFixture();
	const { root, changed, tip, side } = f.commits;
	const { base } = await opened(f);
	expect(await base.source.facts!(base.repository, changed)).toEqual({
		commit: changed,
		tree: f.git.tree(changed),
		parents: [root],
		subject: 'feat: changed',
		author: 'Harness Fixture',
		committedAt: '2026-10-12T08:00:00Z'
	});
	expect(await base.source.facts!(base.repository, 'f'.repeat(40))).toBeNull();
	expect(await base.source.reaches!(base.repository, { tip: tip, commit: changed })).toBe(true);
	expect(await base.source.reaches!(base.repository, { tip: changed, commit: changed })).toBe(true);
	expect(await base.source.reaches!(base.repository, { tip: changed, commit: tip })).toBe(false);
	expect(await base.source.reaches!(base.repository, { tip: changed, commit: side })).toBe(false);
});

test('repeated revision reads preserve pinned facts and reuse attested record bytes', async () => {
	const f = evidenceFixture();
	const { root, changed } = f.commits;
	const { base, history } = await opened(f);
	const read = await hubEvidenceRevision(base, history, changed);
	const { record } = f.records.second;
	expect(read.facts).toEqual({
		...{ commit: changed, tree: f.git.tree(changed), parents: [root], subject: 'feat: changed' },
		...{ author: 'Harness Fixture', committedAt: '2026-10-12T08:00:00Z' }
	});
	expect(read.detail.commit).toBe(changed);
	expect(read.judged).toEqual({
		coverage: 'verified',
		gaps: [],
		records: [
			{
				...{ id: record.id, status: 'passed', profile: 'fixture', finishedAt: record.finishedAt },
				...{ base: root, valid: true, problems: [] }
			}
		]
	});
	expect(read.legacy).toEqual([]);
	const before = blobs(f);
	expect(await hubEvidenceRevision(base, history, changed)).toEqual(read);
	expect(blobs(f)).toBe(before);
	expect(await refusal(hubEvidenceRevision(base, history, 'f'.repeat(40)))).toBe(
		'evidence-unreadable'
	);
});

test('the files of a record are given only where the pinned notes point to it intact', async () => {
	const f = evidenceFixture();
	const { history } = await opened(f);
	const { record, files } = f.records.second;
	expect(await selected(history, record.id)).toEqual(files.get(shot));
	expect(await selected(history, f.records.later.record.id)).toBeUndefined();
	expect(await selected(history, 'unknown')).toBeUndefined();
	const corrupt = evidenceFixture();
	const { commit, path } = corrupt.pointers.first;
	corrupt.git.commits.get(commit)?.files.set(`${path}/captures/clock.txt`, new Uint8Array([1]));
	const again = await opened(corrupt);
	expect(await selected(again.history, corrupt.records.first.record.id)).toBeUndefined();
	// With the later record noted, it is found at those notes and not at the earlier ones.
	const noted = await opened(f, { ...f.pins, notesRevision: f.noteLater() });
	expect(await selected(noted.history, f.records.later.record.id)).toEqual(
		f.records.later.files.get(shot)
	);
	expect(await selected((await opened(f)).history, f.records.later.record.id)).toBeUndefined();
});

async function selected(history: Awaited<ReturnType<typeof opened>>['history'], id: string) {
	const origin = await hubEvidenceOrigin(history, id);
	if (!origin?.record || origin.problems.length) return undefined;
	const line = (await history.verifications()).find((item) => item.record === id);
	if (!line || (await history.problems(line)).length) return undefined;
	return history.attached.readFile(line.evidence, shot);
}
