import { expect, test } from 'vitest';
import { EvidenceRefsAdapter } from '../../src/adapters/EvidenceRefsAdapter';
import { fixture, git } from '../project-fixture';

const notes = (root: string) => git(root, 'rev-parse', 'refs/notes/harness');

test('a repository without notes or evidence is pinned to none of either', async () => {
	const f = await fixture();
	const refs = new EvidenceRefsAdapter(f.root);
	const pinned = await refs.current();
	expect(pinned).toMatchObject({ notesRevision: null, evidenceRevision: null });
	expect(pinned.digest).toMatch(/^[a-f0-9]{64}$/);
	expect(await refs.pinned({ notesRevision: null, evidenceRevision: null })).toEqual({
		notesRevision: null,
		evidenceRevision: null
	});
	// A revision is named where the repository has no such ref: it was never part of it.
	await expect(refs.pinned({ notesRevision: f.tip, evidenceRevision: null })).rejects.toThrow(
		/notes revision/
	);
	await expect(refs.pinned({ notesRevision: null, evidenceRevision: f.tip })).rejects.toThrow(
		/evidence revision/
	);
}, 20_000);

test('the refs are pinned to their commits, and an earlier commit of each stays readable', async () => {
	const f = await fixture();
	const refs = new EvidenceRefsAdapter(f.root);
	git(f.root, 'notes', '--ref=harness', 'add', '-m', 'one', f.base);
	const first = await refs.current();
	git(f.root, 'notes', '--ref=harness', 'add', '-m', 'two', f.tip);
	git(f.root, 'branch', 'harness-evidence', f.feature);
	const second = await refs.current();
	expect(first).toMatchObject({ notesRevision: expect.any(String), evidenceRevision: null });
	expect(second).toMatchObject({ notesRevision: notes(f.root), evidenceRevision: f.feature });
	expect(second.notesRevision).not.toBe(first.notesRevision);
	expect(second.digest).not.toBe(first.digest);
	const earlier = { notesRevision: first.notesRevision, evidenceRevision: f.base };
	expect(await refs.pinned(earlier)).toEqual(earlier);
	const { notesRevision, evidenceRevision } = second;
	expect(await refs.pinned({ notesRevision, evidenceRevision })).toEqual({
		notesRevision,
		evidenceRevision
	});
}, 20_000);

test('a revision its ref never held, or none where there is one, is refused', async () => {
	const f = await fixture();
	const refs = new EvidenceRefsAdapter(f.root);
	git(f.root, 'notes', '--ref=harness', 'add', '-m', 'one', f.base);
	git(f.root, 'branch', 'harness-evidence', f.base);
	const held = await refs.current();
	const { notesRevision, evidenceRevision } = held;
	for (const revision of [f.tip, 'f'.repeat(40), null]) {
		await expect(refs.pinned({ notesRevision: revision, evidenceRevision })).rejects.toThrow(
			/notes revision/
		);
		await expect(refs.pinned({ notesRevision, evidenceRevision: revision })).rejects.toThrow(
			/evidence revision/
		);
	}
}, 20_000);
