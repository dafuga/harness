import type { EvidencePointer, HistoryNote } from '../../../../src/core/historyTypes';
import { noteLines } from '../../../../src/utils/noteLines';
import { fakeGit, type FakeGit } from './evidenceGit';
import {
	check,
	clock,
	json,
	output,
	page,
	png,
	ran,
	screenshot,
	sealed,
	sourceFiles,
	stored,
	verification,
	type Stored
} from './evidenceRecords';

export const notesRef = 'refs/notes/harness';
export const evidenceRef = 'refs/heads/harness-evidence';
type Files = Map<string, Uint8Array>;
type Notes = Map<string, HistoryNote[]>;

/** The evidence branch and the notes of a repository, each grown one commit at a time. */
export function evidenceStore(git: FakeGit) {
	const held: Files = new Map([['harness-evidence.json', json({ schemaVersion: 1 })]]);
	const noted: Notes = new Map();
	let count = 0;
	const grow = (ref: string, files: Files) => {
		const parent = git.refs.get(ref);
		const commit = git.commit(`${ref} ${count++}`, files, parent ? [parent] : []);
		git.refs.set(ref, commit);
		return commit;
	};
	return {
		/** Commits one record directory on top of the evidence, and answers with its pointer. */
		add(item: Stored): EvidencePointer {
			const path = `records/${item.record.id}`;
			for (const [file, bytes] of item.tree) held.set(`${path}/${file}`, bytes);
			for (const [hash, bytes] of item.lfs) git.lfs.set(hash, bytes);
			return { commit: grow(evidenceRef, held), path, manifest: item.manifest };
		},
		/** Adds lines to the note of one commit, or replaces it; every other note is kept. */
		note(commit: string, entries: HistoryNote[], replace = false): string {
			noted.set(commit, [...(replace ? [] : (noted.get(commit) ?? [])), ...entries]);
			const files: Files = new Map();
			[...noted].forEach(([name, lines], index) => {
				// Notes fan the name of a commit out into directories; both forms are held here.
				const path = index % 2 === 0 ? `${name.slice(0, 2)}/${name.slice(2)}` : name;
				files.set(path, new TextEncoder().encode(noteLines(lines)));
			});
			return grow(notesRef, files);
		}
	};
}

function reason(commit: string): Extract<HistoryNote, { kind: 'reason' }> {
	const attempt = { attempt: 'Nothing else was tried.', outcome: 'not-applicable' as const };
	return {
		schemaVersion: 1,
		kind: 'reason',
		commit,
		explanation: {
			unit: page,
			symbol: '*',
			change: 'modified',
			from: 'before',
			to: 'after',
			behavior: 'Shows the changed titles.',
			simplification: attempt,
			performance: attempt,
			recordedAt: '2026-10-12T08:00:00Z'
		}
	};
}

interface Source {
	git: FakeGit;
	root: string;
	changed: string;
}

/** The first commit proves both scenarios itself. */
function first(at: Source): Stored {
	const files: Files = new Map();
	const shot = png('root');
	const text = new TextEncoder().encode('tick\n');
	files.set('captures/titles-default-desktop.png', shot).set('captures/clock.txt', text);
	const record = sealed({
		source: { commit: at.root, tree: at.git.tree(at.root) },
		base: null,
		finishedAt: '2026-10-12T08:00:00Z',
		scenarios: [
			ran(at.root, 'titles-page', screenshot(at.root, shot)),
			ran(at.root, 'clock', output(text))
		],
		tests: [check('titles-page:renders', files), check('clock:ticks', files)],
		direct: [page, clock]
	});
	return stored(record, files);
}

/** The change runs the page again and keeps the clock as the first record proved it. */
function second(at: Source, base: Stored, shot: { bytes: Uint8Array; finishedAt: string }): Stored {
	const files: Files = new Map([['captures/titles-default-desktop.png', shot.bytes]]);
	const kept = base.record.scenarios.find((item) => item.id === 'clock');
	if (!kept) throw new Error('The first record has no clock scenario.');
	const record = sealed({
		source: { commit: at.changed, tree: at.git.tree(at.changed) },
		base: { commit: at.root, record: base.record.id },
		finishedAt: shot.finishedAt,
		scenarios: [
			ran(at.changed, 'titles-page', screenshot(at.changed, shot.bytes)),
			{ ...kept, status: 'referenced', referencedRecord: base.record.id }
		],
		tests: [check('titles-page:renders', files)],
		direct: [page]
	});
	return stored(record, files);
}

/**
 * A repository with its recorded history. `main` is root, changed, tip; `verified` ends at
 * changed; `side` leaves root on its own. Root and changed each have a record; a later record of
 * changed is in the evidence from the start and is noted only when `noteLater` is called.
 */
export function evidenceHistory(options: { screens?: Uint8Array } = {}) {
	const git = fakeGit();
	const root = git.commit('root', sourceFiles('root'));
	const changed = git.commit('changed', sourceFiles('changed'), [root]);
	const tip = git.commit('tip', sourceFiles('tip'), [changed]);
	const side = git.commit('side', sourceFiles('side'), [root]);
	git.refs.set('refs/heads/main', tip).set('refs/heads/verified', changed);
	git.refs.set('refs/heads/side', side);
	const store = evidenceStore(git);
	const at = { git, root, changed };
	const one = first(at);
	const shot = { bytes: options.screens ?? png('changed'), finishedAt: '2026-10-12T09:00:00Z' };
	const two = second(at, one, shot);
	const three = second(at, one, { bytes: png('later'), finishedAt: '2026-10-12T10:00:00Z' });
	const pointers = { first: store.add(one), second: store.add(two), later: store.add(three) };
	store.note(root, [verification(one, pointers.first)]);
	const noted = reason(changed);
	const notes = store.note(changed, [verification(two, pointers.second), noted]);
	return {
		git,
		store,
		/** The one reason noted on the change. */
		noted,
		commits: { root, changed, tip, side },
		records: { first: one, second: two, later: three },
		pointers,
		pins: { notesRevision: notes, evidenceRevision: pointers.later.commit },
		/** A notes-only update: the later record of the change becomes the one that judges it. */
		noteLater: () => store.note(changed, [verification(three, pointers.later)])
	};
}

export type EvidenceHistory = ReturnType<typeof evidenceHistory>;
