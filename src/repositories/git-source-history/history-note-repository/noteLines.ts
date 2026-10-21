import { type HistoryNote } from '../../../core/git-source-history/historyTypes';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';

/** One entry as a note line: canonical JSON, so equal entries are equal lines. */
export function noteLine(entry: HistoryNote): string {
	return canonicalJson(entry);
}

/** Several entries as note text, one canonical line each. */
export function noteLines(entries: HistoryNote[]): string {
	return entries.map((entry) => `${noteLine(entry)}\n`).join('');
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
