import { expect, test } from 'vitest';
import { readdir } from 'node:fs/promises';
import { PinnedHistoryAdapter } from '../../src/adapters/PinnedHistoryAdapter';
import { fixture, git } from '../project-fixture';

const none = { notesRevision: null, evidenceRevision: null };
const unverified = 'no verification record is attached to this commit';
const legacy = (commit: string, id: string) =>
	JSON.stringify({
		schemaVersion: 1,
		kind: 'legacy-report',
		commit,
		id,
		status: 'passed',
		startedAt: '2026-10-01T00:00:00.000Z',
		evidence: { commit, path: `legacy/${id}`, manifest: 'a'.repeat(64) }
	});

test('a commit without a note is built from Git alone, and nothing is written for it', async () => {
	const f = await fixture();
	const before = await readdir(f.root);
	const built = await new PinnedHistoryAdapter(f.root).revision(none, f.tip);
	expect(built.facts).toMatchObject({
		commit: f.tip,
		parents: [f.base],
		subject: 'main source',
		author: 'Fixture',
		committedAt: git(f.root, 'show', '-s', '--format=%cI', f.tip)
	});
	expect(built.detail).toMatchObject({ commit: f.tip, registry: { available: true }, records: [] });
	expect(built.detail.registry.units.map((unit) => unit.id)).toContain('page.home');
	expect(built.judged).toEqual({ coverage: 'unverified', gaps: [unverified], records: [] });
	expect(built.legacy).toEqual([]);
	expect(await readdir(f.root)).toEqual(before);
	expect(git(f.root, 'status', '--short')).toBe('');
}, 60_000);

test('a note is read at the revision it is pinned to, never at where the ref is now', async () => {
	const f = await fixture();
	const history = new PinnedHistoryAdapter(f.root);
	const notes = () => git(f.root, 'rev-parse', 'refs/notes/harness');
	git(f.root, 'notes', '--ref=harness', 'add', '-m', legacy(f.tip, 'legacy-1'), f.tip);
	const first = { notesRevision: notes(), evidenceRevision: null };
	git(f.root, 'notes', '--ref=harness', 'append', '-m', legacy(f.tip, 'legacy-2'), f.tip);
	const second = { notesRevision: notes(), evidenceRevision: null };
	expect((await history.revision(first, f.tip)).legacy).toEqual(['legacy-1']);
	expect((await history.revision(second, f.tip)).legacy).toEqual(['legacy-1', 'legacy-2']);
	expect((await history.revision(none, f.tip)).legacy).toEqual([]);
	expect((await history.revision(first, f.base)).legacy).toEqual([]);
	expect(await history.files(second, 'b'.repeat(64))).toBeUndefined();
}, 60_000);

test('one commit is built once for the revisions it is pinned to', async () => {
	const f = await fixture();
	const history = new PinnedHistoryAdapter(f.root);
	const [one, two] = await Promise.all([
		history.revision(none, f.tip),
		history.revision(none, f.tip)
	]);
	expect(two).toBe(one);
	expect(await history.revision(none, f.base)).not.toBe(one);
	await expect(history.revision(none, 'f'.repeat(40))).rejects.toThrow();
	await expect(history.revision(none, 'f'.repeat(40))).rejects.toThrow();
}, 60_000);
