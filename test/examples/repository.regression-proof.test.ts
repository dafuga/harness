import { sourceAt, focusedShot, unit } from './repository.regression-proof.fixture';
import type { Source, Phase, Draft, Cases } from './repository.regression-proof.test.types';
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import type { RegressionRecord } from '../../src/core/verification-evidence/regressionTypes.types';
import { HistoryNoteRepository } from '../../src/repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import type { RegressionNote } from '../../src/repositories/verification-evidence/RegressionProofRepository.types';
import {
	RegressionProofRepository,
	regressionNotes
} from '../../src/repositories/verification-evidence/RegressionProofRepository';
import { canonicalJson } from '../../src/utils/development-tooling/canonicalJson';
import { checkedMedia } from '../../src/utils/development-tooling/mediaPlace';
import { regressionHash } from '../../src/utils/git-source-history/regressionHistory';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

const loop = 'regression-proof-fixture';
const evidence = 'examples-cases';
const evidenceRef = 'refs/heads/harness-evidence';
const output = Buffer.from('Expected 1 result\n');
/** A 1x1 PNG, the kind of focused screenshot a capture keeps beside its record. */
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);
const unpinned = 'Regression evidence is outside the pinned evidence history.';
const manifestError = 'Regression manifest hash does not match.';
const decodeError = 'Focused capture focused/shot.png cannot be decoded.';

/** Writes one file at the fixture root and commits it; returns the new commit. */
function commitFile(repo: TemporaryRepo, path: string, contents: string): string {
	writeFileSync(`${repo.root}/${path}`, contents);
	repo.git('add', '--', path);
	repo.git('commit', '-q', '-m', `Update ${path}`);
	return repo.git('rev-parse', 'HEAD');
}

/** A checkpoint whose id is the hash of its canonical JSON, which is what load checks. */
function checkpoint(source: Source, phase: Phase, extra: Partial<Draft> = {}): RegressionRecord {
	const draft: Draft = {
		schemaVersion: 1,
		loop,
		phase,
		status: phase === 'red' ? 'failed' : 'passed',
		exitCode: phase === 'red' ? 1 : 0,
		source,
		units: [unit],
		tests: ['focused regression proof is retained'],
		inputs: [{ path: 'app.ts', hash: '0123456789abcdef0123456789abcdef01234567' }],
		command: 'bun run test:unit',
		assertion: 'Expected 1 result',
		profile: 'focused-unit',
		startedAt: '2026-11-14T09:00:00.000Z',
		finishedAt: '2026-11-14T09:00:01.000Z',
		log: { path: 'output.log', sha256: regressionHash(output), bytes: output.length },
		...extra
	};
	return { id: regressionHash(canonicalJson(draft)), ...draft };
}

/** The note the store holds for a checkpoint, as a caller reads it back from the note ref. */
async function noteOf(root: string, record: RegressionRecord): Promise<RegressionNote> {
	const notes = regressionNotes(await new HistoryNoteRepository(root).all());
	const note = notes.find((item) => item.record === record.id);
	if (!note) throw new Error(`No regression note for ${record.id}`);
	return note;
}

/** The refusal a call must give; the same shape is recorded as the case's error. */
const refused = (message: string) => ({ name: 'ExpectedCliError', message });

/** Records one state's cases as its trace evidence; the state id names the file. */
function recordCases(symbol: string, state: string, cases: Cases): void {
	recordExampleCases({ unitId: unit, symbol, state, evidence, file: `${state}.json` }, cases);
}

test('Saves a checkpoint note and keeps its source commit', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'app.ts', 'one\n');
		const commit = commitFile(repo, 'app.ts', 'two\n');
		const record = checkpoint(sourceAt(repo, commit), 'red');
		const store = new RegressionProofRepository(repo.root);
		await store.save(record, output);
		const tip = repo.git('rev-parse', evidenceRef);
		const note = await noteOf(repo.root, record);
		await store.save(record, output);
		expect(note).toMatchObject({ commit, record: record.id });
		expect(repo.git('rev-parse', evidenceRef)).toBe(tip);
		expect(repo.git('rev-parse', `refs/harness/source/${commit}`)).toBe(commit);
		expect(repo.git('rev-list', '--count', 'HEAD')).toBe('2');
		const state = 'saves-a-checkpoint-note-and-keeps-its-source-commit';
		recordCases('RegressionProofRepository.save', state, [
			{ name: 'Stores the checkpoint and appends its note', input: { commit }, output: note },
			{ name: 'Saving it again adds no evidence commit', input: { commit }, output: { tip } }
		]);
	});
}, 20000);

test('Loads a focused capture and refuses unverifiable evidence', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'app.ts', 'one\n');
		const commit = commitFile(repo, 'app.ts', 'two\n');
		const source = sourceAt(repo, commit);
		const store = new RegressionProofRepository(repo.root);
		const shot = checkpoint(source, 'capture', { captures: [focusedShot(commit, png)] });
		await store.save(shot, output, [{ path: 'focused/shot.png', bytes: png }]);
		const note = await noteOf(repo.root, shot);
		const loaded = await store.load(note);
		expect(loaded.record).toEqual(shot);
		expect(loaded.output).toBe('Expected 1 result\n');
		expect(loaded.files.get('focused/shot.png')?.equals(png)).toBe(true);
		const junk = Buffer.from('not an image');
		const broken = checkpoint(source, 'capture', { captures: [focusedShot(commit, junk)] });
		await store.save(broken, output, [{ path: 'focused/shot.png', bytes: junk }]);
		const brokenNote = await noteOf(repo.root, broken);
		const reader = (within: string | null) => new RegressionProofRepository(repo.root, within);
		const tampered = { ...note, evidence: { ...note.evidence, manifest: regressionHash('x') } };
		await expect(store.load(tampered)).rejects.toMatchObject(refused(manifestError));
		await expect(reader(note.evidence.commit).load(brokenNote)).rejects.toMatchObject(
			refused(unpinned)
		);
		await expect(reader(null).load(brokenNote)).rejects.toMatchObject(refused(unpinned));
		await expect(store.load(brokenNote)).rejects.toMatchObject(refused(decodeError));
		const state = 'loads-a-focused-capture-and-refuses-unverifiable-evidence';
		recordCases('RegressionProofRepository.load', state, [
			{
				name: 'Returns the record, its output and the focused bytes',
				input: { commit, file: 'focused/shot.png' },
				output: { output: loaded.output, bytes: loaded.files.get('focused/shot.png')?.length }
			},
			{ name: 'Refuses a manifest hash mismatch', input: tampered, error: refused(manifestError) },
			{ name: 'Refuses newer evidence', input: note.evidence.commit, error: refused(unpinned) },
			{ name: 'Refuses undecodable bytes', input: 'not an image', error: refused(decodeError) }
		]);
	});
}, 20000);

test('Reuses a red proof for a squash commit with the same tree', async () => {
	await withTempRepo(async (repo) => {
		const base = commitFile(repo, 'app.ts', 'one\n');
		const commit = commitFile(repo, 'app.ts', 'two\n');
		const store = new RegressionProofRepository(repo.root);
		const red = checkpoint(sourceAt(repo, commit), 'red');
		await store.save(red, output);
		repo.git('commit', '-q', '--allow-empty', '-m', 'Squash the feature');
		const squash = repo.git('rev-parse', 'HEAD');
		const green = checkpoint(sourceAt(repo, squash), 'green', { red: { commit, record: red.id } });
		await store.save(green, output);
		const notes = await new HistoryNoteRepository(repo.root).all();
		const views = await store.history(commit, notes, checkedMedia);
		expect(views.map((view) => view.red?.commit)).toEqual([commit, commit]);
		expect(views.map((view) => view.green?.commit ?? null)).toEqual([null, squash]);
		const unrelated = await store.history(base, notes, checkedMedia);
		expect(unrelated).toEqual([]);
		const state = 'reuses-a-red-proof-for-a-squash-commit-with-the-same-tree';
		recordCases('RegressionProofRepository.history', state, [
			{ name: 'Reuses the red proof for the squash commit', input: { commit }, output: views },
			{ name: 'No views without a checkpoint', input: { commit: base }, output: unrelated }
		]);
	});
}, 20000);

test('Finds the newest checkpoint on the nearest ancestor commit', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'app.ts', 'one\n');
		const first = commitFile(repo, 'app.ts', 'two\n');
		const second = commitFile(repo, 'app.ts', 'three\n');
		const child = commitFile(repo, 'app.ts', 'four\n');
		const store = new RegressionProofRepository(repo.root);
		const own = checkpoint(sourceAt(repo, first), 'red');
		const earlier = checkpoint(sourceAt(repo, second), 'red', { finishedAt: '2026-11-14T09:10Z' });
		const later = checkpoint(sourceAt(repo, second), 'red', { finishedAt: '2026-11-14T09:20Z' });
		for (const record of [own, earlier, later]) await store.save(record, output);
		const newest = await store.latest(loop, 'red', child);
		expect(newest?.record).toBe(later.id);
		expect((await store.latest(loop, 'red', first))?.record).toBe(own.id);
		expect(await store.latest(loop, 'green', child)).toBeUndefined();
		const state = 'finds-the-newest-checkpoint-on-the-nearest-ancestor-commit';
		const query = { loop, phase: 'red', commit: child };
		const missing = { loop, phase: 'green', commit: child };
		recordCases('RegressionProofRepository.latest', state, [
			{ name: 'Newest red checkpoint of the nearest ancestor', input: query, output: newest },
			{ name: 'No green checkpoint gives null', input: missing, output: null }
		]);
	});
}, 20000);

test('Lists regression notes and skips malformed note lines', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'app.ts', 'one\n');
		const commit = commitFile(repo, 'app.ts', 'two\n');
		const record = checkpoint(sourceAt(repo, commit), 'red');
		await new RegressionProofRepository(repo.root).save(record, output);
		repo.git('notes', '--ref=refs/notes/harness', 'append', '-m', 'not a history entry', commit);
		const notes = await new HistoryNoteRepository(repo.root).all();
		expect(notes.get(commit)?.problems).toHaveLength(1);
		const listed = regressionNotes(notes);
		expect(listed.map((note) => note.record)).toEqual([record.id]);
		expect(regressionNotes(new Map())).toEqual([]);
		const state = 'lists-regression-notes-and-skips-malformed-note-lines';
		recordCases('regressionNotes', state, [
			{ name: 'Keeps the note and drops the malformed line', input: { commit }, output: listed },
			{ name: 'Returns nothing for an empty note map', input: { notes: {} }, output: [] }
		]);
	});
}, 20000);
