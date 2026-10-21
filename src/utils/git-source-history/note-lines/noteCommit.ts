import { historyNoteSchema, type HistoryNote } from '../../../core/git-source-history/historyTypes';

export interface ReadNote {
	/** Valid entries that were written for this commit. */
	entries: HistoryNote[];
	problems: string[];
}

/** The commit an entry was written for. */
export function noteCommit(entry: HistoryNote): string {
	return entry.kind === 'verification' ? entry.source.commit : entry.commit;
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
