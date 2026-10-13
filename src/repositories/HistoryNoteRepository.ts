import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { GitAdapter } from '../adapters/GitAdapter';
import { fail } from '../core/errors';
import { notesRef, type HistoryNote } from '../core/historyTypes';
import { commitIdentity } from '../utils/commitIdentity';
import { mergeNoteLines, noteLines, readNoteLines, type ReadNote } from '../utils/noteLines';

const notes = ['notes', `--ref=${notesRef}`];
const absent = '0'.repeat(40);
const attempts = 20;
const commitId = /^[0-9a-f]{40}$/;

/** The Harness note of a commit: lines are only ever added, and each names its commit. */
export class HistoryNoteRepository {
	private readonly git: GitAdapter;

	constructor(root: string) {
		this.git = new GitAdapter(root);
	}

	/** Raw note text of a commit; empty when it has none. */
	async text(commit: string): Promise<string> {
		const result = await this.git.exec([...notes, 'show', commit]);
		return result.code === 0 ? result.stdout.toString('utf8') : '';
	}

	async read(commit: string): Promise<ReadNote> {
		return readNoteLines(await this.text(commit), commit);
	}

	/** Adds entries to a commit's note, keeping every existing line; false when nothing is new. */
	append(commit: string, entries: HistoryNote[]): Promise<boolean> {
		return this.update(async (ref) => {
			const shown = await this.git.exec(['notes', `--ref=${ref}`, 'show', commit]);
			const before = shown.code === 0 ? shown.stdout.toString('utf8') : '';
			const after = mergeNoteLines(before, noteLines(entries));
			if (after === mergeNoteLines(before, '')) return;
			await this.git.run(['notes', `--ref=${ref}`, 'add', '-f', '-F', '-', commit], {
				input: after,
				env: await commitIdentity(this.git)
			});
		});
	}

	/** Merges another notes ref into ours as a union of lines; false when ours has it all. */
	merge(other: string): Promise<boolean> {
		return this.update(async (ref) => {
			const merge = ['notes', `--ref=${ref}`, 'merge', '--quiet', '-s', 'cat_sort_uniq', other];
			await this.git.run(merge, { env: await commitIdentity(this.git) });
		});
	}

	/**
	 * Git updates a notes ref without checking that it is still where it was read, so two
	 * writers could drop each other's lines. Each change is therefore made on a private ref that
	 * starts at the current notes, and moved into place only if the notes have not moved since;
	 * otherwise it is made again on top of what the other writer added.
	 */
	private async update(change: (ref: string) => Promise<void>): Promise<boolean> {
		const tip = (ref: string) =>
			this.git.attempt(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			const current = await tip(notesRef);
			const pending = `${notesRef}-pending/${process.pid}-${randomUUID()}`;
			try {
				if (current) await this.git.run(['update-ref', pending, current]);
				await change(pending);
				const next = await tip(pending);
				if (!next || next === current) return false;
				const moved = await this.git.exec(['update-ref', notesRef, next, current ?? absent]);
				if (moved.code === 0) return true;
			} finally {
				await this.git.exec(['update-ref', '-d', pending]);
			}
			await delay(5 + Math.random() * 25 * (attempt + 1));
		}
		return fail('The Harness notes kept changing while a line was being added; try again.');
	}

	/**
	 * Every commit that has a note, with the note read for that commit. With a notes commit, the
	 * notes are read as that commit holds them, wherever the ref is by now; null holds none.
	 */
	async all(at?: string | null): Promise<Map<string, ReadNote>> {
		const pairs = at === undefined ? await this.listed() : await this.held(at);
		const texts = await this.blobs(pairs.map(([blob]) => blob));
		return new Map(pairs.map(([, commit], index) => [commit, readNoteLines(texts[index], commit)]));
	}

	/** The note blob of every noted commit, as the notes ref lists them now. */
	private async listed(): Promise<string[][]> {
		const listed = (await this.git.attempt([...notes, 'list'])) ?? '';
		return listed
			.split('\n')
			.filter(Boolean)
			.map((line) => line.split(' '));
	}

	/** The same of one notes commit: its tree names each noted commit, split into directories. */
	private async held(at: string | null): Promise<string[][]> {
		if (at === null) return [];
		if (!commitId.test(at)) return fail('A notes revision must be a full commit hash.');
		const tree = await this.git.run(['ls-tree', '-r', `${at}^{commit}`]);
		return tree.split('\n').flatMap((line) => {
			const [, blob, path = ''] = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line) ?? [];
			const commit = path.replaceAll('/', '');
			return commitId.test(commit) ? [[blob, commit]] : [];
		});
	}

	/** Reads many blobs with one `git cat-file --batch`. */
	private async blobs(ids: string[]): Promise<string[]> {
		if (ids.length === 0) return [];
		const output = await this.git.bytes(['cat-file', '--batch'], { input: `${ids.join('\n')}\n` });
		const texts: string[] = [];
		let offset = 0;
		for (let index = 0; index < ids.length; index += 1) {
			const end = output.indexOf(10, offset);
			const size = Number(output.subarray(offset, end).toString('utf8').split(' ')[2]);
			texts.push(output.subarray(end + 1, end + 1 + size).toString('utf8'));
			offset = end + size + 2;
		}
		return texts;
	}
}
