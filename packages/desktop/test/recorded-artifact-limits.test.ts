import { expect } from '../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import { cloneRepo } from '../../../test/support/verifyRepo';
import {
	clock,
	git,
	notListed,
	opened,
	page,
	recordedRepo,
	sha256,
	shown,
	type Opened,
	type Recorded
} from './recorded-evidence-fixture';
import {
	corruptRecord,
	limit,
	limitRecords,
	markup,
	tamperMedia
} from './recorded-evidence-extras';

let f: Recorded;
let reader: Opened;
let added: { exact: string; over: string };
beforeAll(async () => {
	f = await recordedRepo();
	added = await limitRecords(f.repo);
	reader = await opened(f.root);
}, 300_000);
afterAll(() => f.repo.dispose());

const changed = () => ({ commit: f.commits.changed, branch: 'main', mode: 'commit' as const });
const unvalidated = 'No record of this commit could be validated.';

test('a capture of exactly 11 MiB is read, and one byte more is refused and stays listed', async () => {
	const at = { commit: added.exact, branch: 'main', mode: 'commit' as const };
	const exact = await shown(reader, clock, at);
	const read = await reader.artifact(exact.query);
	expect([read.bytes.length, read.mediaType]).toEqual([limit, 'text/plain; charset=utf-8']);
	expect(sha256(read.bytes)).toBe(exact.query.sha256);
	const over = await shown(reader, clock, { ...at, commit: added.over, mode: 'current' });
	expect(over.found).toMatchObject({ scenario: 'clock', usable: true, current: true });
	expect(over.found.capture.media).toBe(`media/${over.query.sha256}.txt`);
	await expect(reader.artifact(over.query)).rejects.toThrow(/11 MiB/);
	await expect(reader.artifact(over.query)).rejects.toThrow(String(limit + 1));
}, 120_000);

test('markup recorded as a screenshot is listed as rejected and never served', async () => {
	const at = { commit: added.exact, branch: 'main', mode: 'commit' as const };
	const screen = await shown(reader, page, at);
	const { captures, record } = screen.result.evidence.after;
	expect([record?.status, record?.valid, captures.length]).toEqual(['failed', true, 6]);
	expect(screen.query.sha256).toBe(sha256(Buffer.from(markup)));
	for (const item of captures) {
		expect(item).toMatchObject({ standing: 'rejected', usable: false, current: false });
		expect(item.capture).toMatchObject({ mediaType: 'image/png', media: expect.any(String) });
	}
	await expect(reader.artifact(screen.query)).rejects.toThrow(/screenshot/);
	const mobile = { ...screen.query, state: 'filled', viewport: 'mobile' };
	await expect(reader.artifact(mobile)).rejects.toThrow(/screenshot/);
}, 120_000);

test('tampered capture bytes are never returned as verified', async () => {
	const intact = await shown(reader, page, changed());
	const copy = await cloneRepo(f.repo);
	await tamperMedia(copy.root, intact.query.sha256);
	const local = await opened(copy.root);
	const scope = { ...intact.scope, projectId: local.projectId };
	const { evidence, scope: told } = await local.evidence(scope);
	// Both commits recorded the same picture, so neither record can be validated any more.
	for (const side of [evidence.after, evidence.before])
		expect(side).toMatchObject({ record: null, captures: [], gap: unvalidated });
	expect(told.summary).toMatchObject({ coverage: 'invalid', records: [{ valid: false }] });
	expect(told.summary.gaps.join(' ')).toMatch(/does not match its recorded hash/);
	const query = { ...intact.query, projectId: local.projectId };
	await expect(local.artifact(query)).rejects.toThrow(notListed);
	await copy.dispose();
}, 120_000);

test('a corrupted record is never returned as verified', async () => {
	const intact = await shown(reader, page, changed());
	const copy = await cloneRepo(f.repo);
	corruptRecord(copy.root, f.commits.changed);
	const local = await opened(copy.root);
	const scope = { ...intact.scope, projectId: local.projectId };
	const answer = await local.evidence(scope);
	expect(answer.evidence.after).toMatchObject({ record: null, captures: [], gap: unvalidated });
	expect(answer.evidence.before).toMatchObject({ gap: null, record: { valid: true } });
	expect(answer.scope.summary).toMatchObject({ coverage: 'invalid', records: [{ valid: false }] });
	expect(answer.scope.summary.gaps.join(' ')).toMatch(/record\.json does not match its manifest/);
	// Asked at the revisions that hold the forged record, and at those that held the sealed one.
	const pins = {
		notesRevision: git(copy.root, 'rev-parse', 'refs/notes/harness'),
		evidenceRevision: git(copy.root, 'rev-parse', 'refs/heads/harness-evidence')
	};
	const query = { ...intact.query, projectId: local.projectId };
	await expect(local.artifact({ ...query, ...pins })).rejects.toThrow(notListed);
	expect((await local.artifact(query)).sha256).toBe(intact.query.sha256);
	await copy.dispose();
}, 120_000);
