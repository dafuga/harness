import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import type { WritingVersion } from '../../src/utils/writing-limits/writingLimits';
import {
	explanationsFile,
	type Explanation,
	type RequiredReason
} from '../../src/core/explanationTypes';
import { ExplanationRepository } from '../../src/repositories/ExplanationRepository';
import { HistoryNoteRepository } from '../../src/repositories/history-note-repository/HistoryNoteRepository';
import { ExplanationService } from '../../src/services/ExplanationService';
import { HistoryStatusService } from '../../src/services/history-status-service/HistoryStatusService';
import { noteHistoryFixture, noteHistoryMemory } from '../support/noteHistoryFixture';

const root = mkdtempSync(join(tmpdir(), 'harness-notes-order-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const user = ['-c', 'user.name=Fixture', '-c', 'user.email=f@harness.invalid'];
const git = (cwd: string, args: string[]) =>
	String(execFileSync('git', [...user, '-c', 'commit.gpgsign=false', ...args], { cwd })).trim();
let made = 0;

/** A temporary repository of two commits, in the order its notes list them. */
function repository(): { dir: string; commits: string[] } {
	const dir = join(root, `repo-${(made += 1)}`);
	git(root, ['init', '-q', '-b', 'main', dir]);
	const commits = ['one', 'two'].map((name) => {
		writeFileSync(join(dir, `${name}.txt`), `${name}\n`);
		git(dir, ['add', '-A']);
		git(dir, ['commit', '-q', '-m', `feat: ${name}`]);
		return git(dir, ['rev-parse', 'HEAD']);
	});
	return { dir, commits: commits.sort() };
}

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const change: RequiredReason = {
	unit: 'function.slugify',
	symbol: 'slugify',
	file: 'src/utils/slugify.ts',
	change: 'modified',
	from: 'a1',
	to: 'a2'
};
/** A reason whose first attempt has so many words; a note sorts its lines by behaviour. */
const reason = (attempt: number, recordedAt: string, behavior: string, to = 'a2'): Explanation => ({
	...change,
	to,
	behavior,
	simplification: { attempt: words(attempt), outcome: 'not-improved' },
	performance: { attempt: 'No hot path is touched.', outcome: 'not-applicable' },
	recordedAt
});
/** As Harness writes a date, in milliseconds, and as an import wrote one, in microseconds. */
const [earlier, later] = ['2026-10-12T00:26:11.111Z', '2026-10-15T18:00:30.843957Z'];
const long = 'function.slugify slugify: simplification attempt has 16 words; the limit is 15.';

/**
 * Notes each reason on the commit at its place, 0 or 1 in listing order, in a repository with no
 * scratch file, and asks which reasons explain the change from those notes alone.
 */
async function held(reasons: Explanation[], places: number[], writing: WritingVersion = 2) {
	const { dir, commits } = repository();
	const notes = new HistoryNoteRepository(dir);
	for (const [index, explanation] of reasons.entries()) {
		const commit = commits[places[index]];
		await notes.append(commit, [{ schemaVersion: 1, kind: 'reason', commit, explanation }]);
	}
	const known = await new ExplanationRepository(dir).all();
	const told = new ExplanationService().report([change], known, writing);
	// Every original is still read as it was noted, with its own date; nothing came from scratch.
	expect(known).toHaveLength(reasons.length);
	expect(known).toEqual(expect.arrayContaining(reasons));
	expect(existsSync(join(dir, explanationsFile))).toBe(false);
	return { failures: told.failures, overlong: told.overlong, entries: told.entries };
}
/** Each reason on either commit, then all of them in one note. */
const across = (count: number) =>
	count === 2
		? [
				[0, 1],
				[1, 0],
				[0, 0]
			]
		: [
				[0, 1, 0],
				[1, 0, 0],
				[0, 0, 1],
				[1, 1, 0]
			];

test('notes alone hold the latest recorded reason for an exact change, wherever each is noted', async () => {
	const wordy = reason(16, earlier, 'Shouts every title, first written.');
	const short = reason(15, later, 'Shouts every title, a later note.');
	for (const places of across(2)) {
		expect([places, await held([wordy, short], places)]).toEqual([
			places,
			{ failures: [], overlong: [], entries: [short] }
		]);
	}
}, 20_000);

test('a step of a chain noted again is held by its latest reason, wherever each is noted', async () => {
	const wordy = reason(16, earlier, 'Shouts every title, first written.', 'm');
	const short = reason(15, later, 'Shouts every title, a later note.', 'm');
	const rest = { ...reason(15, earlier, 'Keeps every title shouted.'), from: 'm' };
	for (const places of across(3)) {
		expect([places, await held([wordy, short, rest], places)]).toEqual([
			places,
			{ failures: [], overlong: [], entries: [short, rest] }
		]);
	}
}, 20_000);

test('a later long reason in the notes still fails, however the notes list it', async () => {
	const short = reason(15, earlier, 'Shouts every title, first written.');
	const wordy = reason(16, later, 'Shouts every title, a later note.');
	for (const places of across(2)) {
		expect([places, await held([short, wordy], places)]).toEqual([
			places,
			{ failures: [long], overlong: [change], entries: [wordy] }
		]);
		// The revision's declared version, never a date, decides the limit: 16 words pass under 1.
		expect(await held([short, wordy], places, 1)).toEqual({
			failures: [],
			overlong: [],
			entries: [wordy]
		});
	}
}, 20_000);

test('a date that cannot be read is never later than one that can; equal ones agree everywhere', async () => {
	const short = reason(15, 'before dates were kept', 'Shouts every title, a later note.');
	const wordy = reason(16, earlier, 'Shouts every title, first written.');
	for (const places of across(2)) {
		expect([places, await held([short, wordy], places)]).toEqual([
			places,
			{ failures: [long], overlong: [change], entries: [wordy] }
		]);
	}
	// Two reasons with the same date give one answer, whichever commit notes either of them.
	const twin = reason(16, later, 'Shouts every title, first written.');
	const other = reason(15, later, 'Shouts every title, a later note.');
	const answers = await Promise.all(across(2).map((places) => held([twin, other], places)));
	expect(new Set(answers.map((answer) => JSON.stringify(answer))).size).toBe(1);
}, 20_000);

test('restoration keeps a large note history bounded and still refuses missing evidence', async () => {
	const { dir, commits } = repository();
	await noteHistoryFixture(dir, commits, (args) => git(dir, args), reason(2, earlier, 'A change.'));
	const raw = await noteHistoryMemory(dir, 'raw');
	const restored = await noteHistoryMemory(dir, 'restore');
	expect(raw.value).toBeGreaterThan(30_000_000);
	expect(restored.value).toEqual({
		restored: [],
		skipped: [
			{
				record: 'missing-verification',
				problems: [expect.stringContaining('is not available')]
			}
		]
	});
	console.log(`Note history RSS: restore ${restored.rss}; raw ${raw.rss}`);
	expect(restored.rss).toBeLessThan(raw.rss + 300 * 1024 * 1024);
	const expected = await new HistoryStatusService(dir).verifications();
	const actual = await new HistoryNoteRepository(dir).verifications();
	expect(expected).toHaveLength(2);
	expect(actual).toEqual(expected);
}, 120_000);

test('a large note retains every valid verification entry in order', async () => {
	const { dir, commits } = repository();
	const [commit] = commits;
	const note = {
		schemaVersion: 1,
		kind: 'verification',
		record: 'record-1',
		status: 'passed',
		profile: 'profile-1',
		finishedAt: earlier,
		source: { commit, tree: git(dir, ['rev-parse', `${commit}^{tree}`]), base: null },
		evidence: { commit, path: 'records/one', manifest: 'a'.repeat(64) }
	};
	const file = join(root, 'large-verification-note.txt');
	writeFileSync(file, `${JSON.stringify(note)}\n`.repeat(150_000));
	git(dir, ['notes', '--ref=harness', 'add', '-F', file, commit]);
	const found = await new HistoryNoteRepository(dir).verifications();
	expect(found).toHaveLength(150_000);
	expect(found[0]).toEqual(note);
	expect(found.at(-1)).toEqual(note);
}, 120_000);
