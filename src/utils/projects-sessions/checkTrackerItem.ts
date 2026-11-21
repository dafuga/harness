// @harness-uid u_gfp6bkgz67
import { trackerItemError } from './trackerItemError';
import type {
	TrackerCandidateRow,
	TrackerItemMatch,
	TrackerItemMatches,
	TrackerMatchOptions,
	TrackerMatchRow
} from './checkTrackerItem.types';

const fillerWords = new Set(
	`a an and are as at be been being but by can could did do does doing for from
had has have having he her his how i if in into is it its just me my no nor
not of on once only or our own same she should so some such than
that the their them then there these they this those through to too
until very was we were what when where which while who whom why will with
would you your yet again also any all both each few more most other about
between during further here
daniel please need needs needed now still re fwd fyi asap today tomorrow`.split(/\s+/)
);

/** Match a check probe against the same raw rows scanned by Tracker 122e190. */
export function checkTrackerItem(
	rows: readonly TrackerMatchRow[],
	text: string | null | undefined,
	options: TrackerMatchOptions = {}
): TrackerItemMatches {
	const query = text?.trim();
	if (!query) throw trackerItemError('check needs some text to search for');
	const probe = matchWords(query);
	const matches: TrackerItemMatches = { ignored: [], open: [] };
	if (!probe.size) return matches;

	for (const row of rows) {
		if (!isCandidate(row, options.excludeId)) continue;
		const match = matchRow(probe, row, options.agent);
		if (match) matches[row.status === 'ignored' ? 'ignored' : 'open'].push(match);
	}
	return { ignored: rank(matches.ignored), open: rank(matches.open) };
}

function isCandidate(row: TrackerMatchRow, excludeId?: string): row is TrackerCandidateRow {
	return (
		row.id !== excludeId &&
		!row.deleted &&
		row.title !== null &&
		row.status !== null &&
		row.status !== 'done'
	);
}

function rank(matches: TrackerItemMatch[]): TrackerItemMatch[] {
	return matches
		.sort((a, b) => Number(b.same_agent) - Number(a.same_agent) || b.score - a.score)
		.slice(0, 5);
}

function matchWords(text: string): Set<string> {
	const words = new Set<string>();
	for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
		if (word.length >= 2 && !fillerWords.has(word)) words.add(singularWord(word));
	}
	return words;
}

function singularWord(word: string): string {
	if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
	if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
	return word;
}

function compare(probe: Set<string>, candidate: Set<string>) {
	const shared = [...probe].filter((word) => candidate.has(word));
	const sameWords = shared.length === probe.size && shared.length === candidate.size;
	if (shared.length < 2 && !sameWords) return { containment: 0, dice: 0, shared, sameWords };
	return {
		containment: shared.length / Math.min(probe.size, candidate.size),
		dice: (2 * shared.length) / (probe.size + candidate.size),
		shared,
		sameWords
	};
}

function bestMatch(probe: Set<string>, row: TrackerCandidateRow) {
	const titleWords = matchWords(row.title);
	const title = compare(probe, titleWords);
	if (!titleWords.size || !row.question) return title;
	const both = compare(probe, matchWords(`${row.title} ${row.question}`));
	if (both.dice > title.dice) return both;
	if (both.dice === title.dice && both.containment > title.containment) return both;
	return title;
}

function matchRow(
	probe: Set<string>,
	row: TrackerCandidateRow,
	agent: unknown
): TrackerItemMatch | undefined {
	const similarity = bestMatch(probe, row);
	const ignored = row.status === 'ignored';
	const score = matchScore(similarity, ignored);
	if (!score) return undefined;
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		agent: row.agent ?? null,
		owner: row.owner ?? null,
		question: row.question ?? null,
		needs_daniel: Boolean(row.needs_daniel) && !row.resolved,
		score: Math.round(score * 100) / 100,
		shared: similarity.shared,
		same_agent: Boolean(agent) && row.agent === agent,
		...(ignored ? ignoredDetails(row) : {})
	};
}

function ignoredDetails(row: TrackerCandidateRow) {
	return {
		ignored_reason: row.ignored_reason ?? null,
		ignored_by: row.ignored_by ?? null,
		ignored_at: row.ignored_at ?? null,
		ignored_until: row.ignored_until ?? null
	};
}

function matchScore(similarity: ReturnType<typeof compare>, ignored: boolean): number {
	if (ignored) return similarity.containment >= 0.6 ? similarity.containment : 0;
	if (similarity.dice <= 0.8 || (similarity.shared.length < 3 && !similarity.sameWords)) return 0;
	return similarity.dice;
}
