// @harness-uid u_r7qgepnoax
import { isTrackerResumeNote } from '../../../utils/projects-sessions/isTrackerResumeNote';
import type { TrackerItemNote } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { NativeTrackerItemDetail } from './nativeTrackerCli.types';

/** A session reads this output into its context, so one command prints a bounded amount. */
const pageChars = 12_000;
const noteChars = 2_000;
const handoffChars = 4_000;

const noteLine = ({ at, node, text }: TrackerItemNote) => `  note ${at} [${node}]: ${text}`;

const cutLine = (line: string, limit: number) =>
	line.length > limit ? `${line.slice(0, limit)}… [cut]` : line;

/** The newest notes and the latest handoff; every note stays readable through the pages. */
export function formatNativeTrackerNotes(item: NativeTrackerItemDetail): string[] {
	const notes = item.notes_log ?? [];
	const lines = notes.map(noteLine);
	if (lines.join('\n').length <= pageChars) return lines;
	const shown = recentLines(notes, lines);
	const pointer = `  notes: showing ${shown.length} of ${notes.length}. Every note in full: tracker show ${item.id.slice(0, 6)} --notes-page 1 (to ${notePages(lines).length})`;
	return [pointer, ...shown];
}

function recentLines(notes: readonly TrackerItemNote[], lines: readonly string[]): string[] {
	const resumes = notes.map(({ text }) => isTrackerResumeNote(text));
	const handoff = resumes.lastIndexOf(true);
	const shown = new Map<number, string>();
	if (handoff >= 0) shown.set(handoff, cutLine(lines[handoff], handoffChars));
	let used = shown.get(handoff)?.length ?? 0;
	for (let index = lines.length - 1; index >= 0; index--) {
		if (shown.has(index)) continue;
		const line = cutLine(lines[index], noteChars);
		used += line.length + 1;
		if (used > pageChars) break;
		shown.set(index, line);
	}
	return [...shown].sort(([left], [right]) => left - right).map(([, line]) => line);
}

function notePages(lines: readonly string[]): string[] {
	const pages: string[] = [];
	let page = '';
	for (const line of lines) {
		if (page && page.length + line.length >= pageChars) {
			pages.push(page);
			page = '';
		}
		page = page ? `${page}\n${line}` : line;
		while (page.length > pageChars) {
			pages.push(page.slice(0, pageChars));
			page = page.slice(pageChars);
		}
	}
	return page ? [...pages, page] : pages;
}

/** Prints one page of the full history, oldest first, and returns the exit code. */
export function renderTrackerNotesPage(item: NativeTrackerItemDetail, requested: string): number {
	const pages = notePages((item.notes_log ?? []).map(noteLine));
	const number = /^[1-9]\d*$/.test(requested) ? Number(requested) : 0;
	const page = pages[number - 1];
	if (page === undefined) {
		console.error(`tracker: --notes-page takes 1 to ${pages.length} for this item.`);
		return 1;
	}
	const next = number < pages.length ? `next: --notes-page ${number + 1}` : 'last page';
	console.log(`${item.id.slice(0, 6)} notes page ${number} of ${pages.length}; ${next}\n${page}`);
	return 0;
}
