import { historyNoteSchema, type HistoryNote } from '../core/historyTypes';
import { canonicalJson } from './canonicalJson';

export interface ReadNote {
	/** Valid entries that were written for this commit. */
	entries: HistoryNote[];
	problems: string[];
}

/** One entry as a note line: canonical JSON, so equal entries are equal lines. */
export function noteLine(entry: HistoryNote): string {
	return canonicalJson(entry);
}

/** Several entries as note text, one canonical line each. */
export function noteLines(entries: HistoryNote[]): string {
	return entries.map((entry) => `${noteLine(entry)}\n`).join('');
}

/** The commit an entry was written for. */
export function noteCommit(entry: HistoryNote): string {
	return entry.kind === 'verification' ? entry.source.commit : entry.commit;
}

/**
 * Merges two notes as a sorted union of their lines. Writers only ever add lines, so the union
 * keeps every result whatever order the writers are merged in.
 */
export function mergeNoteLines(left: string, right: string): string {
	const lines = new Set(`${left}\n${right}`.split('\n').filter((line) => line.trim() !== ''));
	return [...lines]
		.sort()
		.map((line) => `${line}\n`)
		.join('');
}

/**
 * Reads a note for one commit. A line that is not a valid entry, or that was written for
 * another commit and copied here, is reported and never used.
 */
export function readNoteLines(text: string, commit: string): ReadNote {
	const result: ReadNote = { entries: [], problems: [] };
	text.split('\n').forEach((line, index) => {
		if (line.trim() === '') return;
		const parsed = historyNoteSchema.safeParse(parseJson(line));
		if (!parsed.success) {
			result.problems.push(`note line ${index + 1} is not a valid history entry`);
		} else if (noteCommit(parsed.data) !== commit) {
			const written = noteCommit(parsed.data);
			result.problems.push(
				`note line ${index + 1} was written for commit ${written}, not this commit`
			);
		} else result.entries.push(parsed.data);
	});
	return result;
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}
