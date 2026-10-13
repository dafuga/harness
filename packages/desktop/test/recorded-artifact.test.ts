import { expect } from '../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { attach, lfsObjectPath } from '../../../test/support/historyRepo';
import { cloneRepo } from '../../../test/support/verifyRepo';
import { mediaFile } from '../../reports/src/utils/harnessEvidence';
import { artifactQuery } from '../src/utils/artifactQuery';
import { fixture } from './project-fixture';
import {
	binding,
	clock,
	git,
	notListed,
	opened,
	page,
	recordedRepo,
	sha256,
	shown,
	title,
	type Opened,
	type Recorded
} from './recorded-evidence-fixture';

let f: Recorded;
let reader: Opened;
beforeAll(async () => {
	f = await recordedRepo();
	reader = await opened(f.root);
}, 240_000);
afterAll(() => f.repo.dispose());

const tip = () => ({ commit: f.commits.changed, branch: 'verified', mode: 'current' as const });
const within = () => ({ commit: f.commits.changed, branch: 'main', mode: 'commit' as const });

test('a listed capture is read as its recorded bytes, with a media type that was checked', async () => {
	const screen = await shown(reader, page, tip());
	const file = mediaFile(screen.found.capture);
	// Exactly what the viewer asks: the request it makes from the answer it was given.
	const viewer = artifactQuery(screen.result, screen.scope, 'after', file);
	expect(viewer).toEqual(screen.query);
	const image = await reader.artifact(screen.query);
	const stored = await readFile(lfsObjectPath(f.root, screen.found.capture.sha256));
	expect([image.mediaType, image.sha256]).toEqual(['image/png', screen.found.capture.sha256]);
	expect(Buffer.from(image.bytes).equals(stored)).toBe(true);
	const sound = await shown(reader, title, tip());
	const audio = await reader.artifact(sound.query);
	expect(sound.found.capture.kind).toBe('audio');
	expect([audio.mediaType, sha256(audio.bytes)]).toEqual(['audio/wav', sound.query.sha256]);
	// A benchmark is a measurement: it is listed, and its bytes are not served.
	const [, bench] = sound.result.evidence.after.captures;
	expect(bench.capture).toMatchObject({ kind: 'benchmark', media: expect.any(String) });
	const measured = binding(sound.result, sound.scope, bench);
	await expect(reader.artifact(measured)).rejects.toThrow(/benchmark/);
}, 60_000);

test('an inherited result is read from the record that produced it, on either side', async () => {
	const run = await shown(reader, clock, within());
	const [earlier] = run.result.evidence.before?.captures ?? [];
	expect(run.found.inheritedFrom).toBe(f.commits.baseline);
	const after = await reader.artifact(run.query);
	const before = await reader.artifact(binding(run.result, run.scope, earlier, 'before'));
	const source = git(f.root, 'show', `${f.commits.baseline}:src/utils/clock.ts`);
	expect(after.mediaType).toBe('text/plain; charset=utf-8');
	expect(Buffer.from(after.bytes).toString('utf8').trim()).toBe(source);
	expect([sha256(after.bytes), sha256(before.bytes)]).toEqual([run.query.sha256, run.query.sha256]);
	expect(run.query.recordId).not.toBe(run.result.evidence.before?.record?.id);
}, 60_000);

test('a capture of another entity, record, side or hash is refused', async () => {
	const own = await shown(reader, page, within());
	const foreign = await shown(reader, clock, within());
	const refused = (change: object) => reader.artifact({ ...own.query, ...change });
	// The output of the clock, asked for as if it were of the page.
	await expect(reader.artifact({ ...foreign.query, entityId: page })).rejects.toThrow(notListed);
	await expect(refused({ sha256: foreign.query.sha256 })).rejects.toThrow(notListed);
	await expect(refused({ sha256: 'a'.repeat(64) })).rejects.toThrow(notListed);
	await expect(refused({ recordId: 'b'.repeat(64) })).rejects.toThrow(notListed);
	// The same picture is on both sides, each in the record of its own commit.
	const earlier = own.result.evidence.before?.record?.id;
	await expect(refused({ recordId: earlier })).rejects.toThrow(notListed);
	await expect(refused({ side: 'before' })).rejects.toThrow(notListed);
	await expect(refused({ ...tip(), side: 'before' })).rejects.toThrow(notListed);
	for (const change of [
		{ scenarioId: 'clock' },
		{ state: 'offline' },
		{ evidenceId: 'speech' },
		{ viewport: 'watch' },
		{ viewport: null }
	])
		await expect(refused(change)).rejects.toThrow(notListed);
	expect((await refused({})).sha256).toBe(own.query.sha256);
}, 60_000);

test('a capture is read only in the project that recorded it', async () => {
	const own = await shown(reader, page, tip());
	const elsewhere = await fixture();
	const other = await opened(elsewhere.root);
	expect(other.projectId).not.toBe(reader.projectId);
	await expect(other.artifact(own.query)).rejects.toThrow('The requested project is not selected.');
	await expect(reader.artifact({ ...own.query, projectId: other.projectId })).rejects.toThrow(
		'The requested project is not selected.'
	);
	await expect(other.artifact({ ...own.query, projectId: other.projectId })).rejects.toThrow();
	const tipOf = { commit: elsewhere.tip, branch: 'main', mode: 'current' as const };
	const theirs = { ...own.query, ...tipOf, projectId: other.projectId, entityId: 'page.home' };
	await expect(other.artifact(theirs)).rejects.toThrow(/revision/);
}, 60_000);

test('a notes-only update renews the identity and keeps the shown artifact readable', async () => {
	const copy = await cloneRepo(f.repo);
	const local = await opened(copy.root);
	const first = await shown(local, page, tip());
	const { notesRevision, evidenceRevision } = first.result.identity;
	const bytes = (await local.artifact(first.query)).bytes;
	const foreign = '{"kind":"written-by-another-tool"}';
	await copy.git(['notes', '--ref=harness', 'append', '-m', foreign, f.commits.unverified]);
	const second = await shown(local, page, tip());
	const moved = git(copy.root, 'rev-parse', 'refs/notes/harness');
	expect(moved).not.toBe(notesRevision);
	expect(second.result.identity).toMatchObject({ notesRevision: moved, evidenceRevision });
	expect(second.result.evidence).toEqual(first.result.evidence);
	expect(Buffer.from((await local.artifact(first.query)).bytes).equals(bytes)).toBe(true);
	// A revision the ref never held is refused, and so is none where there is one.
	const never = [f.commits.changed, 'f'.repeat(40), null];
	for (const revision of never) {
		const notes = { ...first.query, notesRevision: revision };
		const evidence = { ...first.query, evidenceRevision: revision };
		await expect(local.artifact(notes)).rejects.toThrow(/notes revision/);
		await expect(local.artifact(evidence)).rejects.toThrow(/evidence revision/);
	}
	// Earlier revisions did not hold this record yet: nothing newer stands in for it.
	const earlier = (revision: string | null) => git(copy.root, 'rev-parse', `${revision}~1`);
	const unnoted = { ...first.query, notesRevision: earlier(notesRevision) };
	const unstored = { ...first.query, evidenceRevision: earlier(evidenceRevision) };
	await expect(local.artifact(unnoted)).rejects.toThrow(notListed);
	await expect(local.artifact(unstored)).rejects.toThrow(notListed);
	await copy.dispose();
}, 120_000);

test('a newer record of the same commit never stands in for the one that was shown', async () => {
	const copy = await cloneRepo(f.repo);
	const local = await opened(copy.root);
	const first = await shown(local, page, tip());
	await copy.git(['checkout', '-q', 'verified']);
	const again = await copy.verify();
	await attach(copy);
	const second = await shown(local, page, tip());
	expect(second.query.recordId).toBe(again.record.id);
	expect(second.query.recordId).not.toBe(first.query.recordId);
	expect(second.result.identity.evidenceRevision).not.toBe(first.query.evidenceRevision);
	// What was shown is still read at the revisions it was shown at, from its own record.
	expect((await local.artifact(first.query)).sha256).toBe(first.query.sha256);
	const { notesRevision, evidenceRevision } = second.result.identity;
	const renewed = { ...first.query, notesRevision, evidenceRevision };
	await expect(local.artifact(renewed)).rejects.toThrow(notListed);
	expect((await local.artifact(second.query)).sha256).toBe(second.query.sha256);
	await copy.dispose();
}, 120_000);
