// @harness-uid u_r7qgepnoax
import type {
	TrackerItemMatch,
	TrackerItemMatches
} from '../../../utils/projects-sessions/checkTrackerItem.types';

export function formatNativeTrackerCheck(matches: TrackerItemMatches): string {
	if (!matches.ignored.length && !matches.open.length)
		return 'no similar items (not ignored, not already open)';
	return formatNativeTrackerMatches(matches, '');
}

/** List each match with who decided what, then say what to do instead of reporting it again. */
export function formatNativeTrackerMatches(matches: TrackerItemMatches, prefix: string): string {
	return [...ignoredLines(matches.ignored, prefix), ...openLines(matches.open, prefix)].join('\n');
}

function ignoredLines(matches: TrackerItemMatch[], prefix: string): string[] {
	if (!matches.length) return [];
	return [
		`${prefix}already reported, and Daniel decided to IGNORE it:`,
		...matches.flatMap((match) => [
			`  [${match.id.slice(0, 6)}] ${match.title}${match.agent ? ` (agent ${match.agent})` : ''}`,
			`      ${ignoredDecision(match)}`
		]),
		'  Do not report it again. Use --force only if this is genuinely a different problem.'
	];
}

function ignoredDecision(match: TrackerItemMatch): string {
	const day = String(match.ignored_at ?? '').slice(0, 10);
	const until = match.ignored_until ? ` (until ${match.ignored_until})` : '';
	return `ignored ${day} by ${match.ignored_by ?? '?'}: ${match.ignored_reason ?? '(no reason)'}${until}`;
}

function openLines(matches: TrackerItemMatch[], prefix: string): string[] {
	if (!matches.length) return [];
	return [
		`${prefix}a similar item is already open:`,
		...matches.map(openLine),
		`  Add to it instead: tracker note ${matches[0].id.slice(0, 6)} "..."  (or pass --force if this is genuinely separate)`
	];
}

function openLine({ id, title, status, needs_daniel, agent }: TrackerItemMatch): string {
	const details = [status, needs_daniel && 'needs Daniel', agent && `agent ${agent}`];
	return `  [${id.slice(0, 6)}] ${title}  (${details.filter(Boolean).join(', ')})`;
}
