// @harness-uid u_bl6xl2h4a3
import type {
	TrackerItem,
	TrackerItemNote
} from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { isTrackerResumeNote } from '../../../utils/projects-sessions/isTrackerResumeNote';

const recentCount = 10;
const recentChars = 6_000;
const noteChars = 1_200;
const handoffChars = 4_000;
/** Tracker's own bookkeeping, which carries nothing a new session acts on. */
const routineNote = /^(?:watchdog context:|Closed finished run session |auto-launch requested )/;

const cut = (text: string, limit: number) =>
	text.length > limit ? `${text.slice(0, limit)}…` : text;

export function trackerBriefNotes(item: TrackerItem, recovery: boolean) {
	const handoff = recovery
		? item.notes_log.filter(({ text }) => isTrackerResumeNote(text)).at(-1)
		: undefined;
	return [
		recentNotes(item, handoff),
		handoff && `## Last handoff\n\n${cut(handoff.text, handoffChars)}`
	];
}

function recentNotes(item: TrackerItem, handoff?: TrackerItemNote) {
	const useful = item.notes_log.filter((note) => note !== handoff && !routineNote.test(note.text));
	const lines: string[] = [];
	let used = 0;
	for (const { at, text } of useful.slice(-recentCount).reverse()) {
		const line = `- ${at} ${cut(text, noteChars)}`;
		used += line.length + 1;
		if (used > recentChars) break;
		lines.unshift(line);
	}
	if (!lines.length) return undefined;
	const hidden = useful.length - lines.length;
	const partial = hidden > 0 || useful.some(({ text }) => text.length > noteChars);
	const pointer =
		partial &&
		`${hidden} earlier notes are not shown and … marks a cut note. \`tracker show ${item.id.slice(0, 6)} --notes-page 1\` pages through every note.`;
	return ['## Recent notes\n', ...lines, ...(pointer ? [pointer] : [])].join('\n');
}
