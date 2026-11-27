// @harness-uid u_fy55qn2j57
import type { TrackerStage } from '../../../../../../src/utils/projects-sessions/trackerPlanning.types';

import type {
	ConfirmedWrite,
	InboxBucket,
	InboxDetail,
	InboxReview,
	InboxFilter,
	InboxFlag,
	InboxOption,
	InboxRow,
	InboxWrite,
	InboxWriteView,
	ReviewGate,
	WriteAction,
	WriteState
} from '../../../models/development-tooling/TrackerInbox.types';

export const trackerStageLabels: Record<TrackerStage, string> = {
	idea: 'Idea',
	detail: 'Detailed idea',
	design: 'Full design',
	build: 'Implementation'
};

export const inboxFilters: readonly InboxFilter[] = [
	'all',
	'needs-you',
	'blocked',
	'active',
	'quiet',
	'done',
	'reminders'
];

export const bucketLabels: Record<InboxBucket, string> = {
	'needs-you': 'Needs you',
	blocked: 'Blocked',
	active: 'Active',
	quiet: 'Quiet',
	done: 'Done'
};

const MAX_TEXT_BYTES = 512;

export function filterLabel(filter: InboxFilter): string {
	if (filter === 'all') return 'All';
	return filter === 'reminders' ? 'Reminders' : bucketLabels[filter];
}

/** An open structured ask puts the item in Needs you. Otherwise the item status decides. */
export function itemBucket(status: string, flagOpen: boolean): InboxBucket {
	if (flagOpen) return 'needs-you';
	if (status === 'blocked') return 'blocked';
	if (status === 'in_progress') return 'active';
	if (status === 'done' || status === 'ignored') return 'done';
	return 'quiet';
}

export function countBuckets(
	rows: readonly InboxRow[],
	reminders = 0
): Record<InboxFilter, number> {
	const counts: Record<InboxFilter, number> = {
		all: rows.length,
		'needs-you': 0,
		blocked: 0,
		active: 0,
		quiet: 0,
		done: 0,
		reminders
	};
	for (const row of rows) counts[row.bucket] += 1;
	return counts;
}

export function filterRows(rows: readonly InboxRow[], filter: InboxFilter): InboxRow[] {
	return filter === 'all' ? [...rows] : rows.filter((row) => row.bucket === filter);
}

/** Case-insensitive literal match on ID or title. Mirrors the phone's own search. */
export function matchesQuery(row: InboxRow, query: string): boolean {
	const term = query.trim().toLowerCase();
	if (term === '') return true;
	return (
		row.header.id.toLowerCase().includes(term) || row.header.title.toLowerCase().includes(term)
	);
}

/** Maps the outbox entry to the state the user sees. A changed flag needs a fresh review. */
export function writeView(entry: InboxWrite): InboxWriteView {
	const base = { intentId: entry.intentId, itemId: entry.itemId };
	if (entry.status === 'queued')
		return view(base, 'pending', 'Waiting to reach the Tracker', false);
	if (entry.status === 'accepted')
		return view(base, 'acknowledged', 'The Tracker accepted it', false);
	if (entry.reason === 'attention') {
		return view(base, 'conflict', 'The flag changed. Review it again before you answer.', true);
	}
	const label =
		entry.reason === 'item'
			? 'The item is no longer on this phone.'
			: 'The Tracker did not accept this write.';
	return view(base, 'rejected', label, true);
}

function view(
	base: { intentId: string; itemId: string },
	state: WriteState,
	label: string,
	discardable: boolean
): InboxWriteView {
	return { ...base, state, label, discardable };
}

/**
 * Decides whether a write may be offered. A flag or answer needs the reviewed revision to match
 * the current one, and an answer needs a flag that is still open.
 */
export function writeGate(
	action: WriteAction,
	detail: Pick<InboxDetail, 'flag' | 'revision'>,
	reviewed: { revision: string | null } | null
): ReviewGate {
	if (action === 'note') return { allowed: true };
	const refused = flagStateGate(action, detail.flag);
	if (refused) return refused;
	if (reviewed === null) return { allowed: false, reason: 'unreviewed' };
	if (reviewed.revision !== detail.revision) return { allowed: false, reason: 'changed' };
	return { allowed: true };
}

/** An answer needs an open flag. A new flag cannot land on an item that already has one open. */
function flagStateGate(action: WriteAction, flag: InboxFlag | null): ReviewGate | null {
	if (action === 'answer' && flag === null) return { allowed: false, reason: 'no-flag' };
	if (action === 'answer' && flag?.state !== 'open') return { allowed: false, reason: 'answered' };
	if (action === 'flag' && flag?.state === 'open')
		return { allowed: false, reason: 'already-open' };
	return null;
}

export function flagQuestion(flag: InboxFlag | null): string {
	return flag?.question.trim() || 'No question was recorded with this flag.';
}

/**
 * Builds the write only after an explicit confirmation. Text is trimmed and bounded to 512 UTF-8
 * bytes. A flag or answer carries the revision that the user reviewed.
 */
export function confirmedWrite(
	draft: {
		action: WriteAction;
		id: string;
		text: string;
		revision: string | null;
		option?: number;
	},
	confirmed: boolean
): ConfirmedWrite | null {
	if (confirmed !== true) return null;
	const text = draft.text.trim();
	if (text === '' || new TextEncoder().encode(text).length > MAX_TEXT_BYTES) return null;
	return {
		action: draft.action,
		id: draft.id,
		text,
		revision: draft.action === 'note' ? null : draft.revision,
		...(draft.action === 'answer' && draft.option !== undefined && { option: draft.option })
	};
}

/** The options as the buttons show them: recommended first, each with its original 1-based number. */
export function orderedOptions(flag: InboxFlag | null): { number: number; option: InboxOption }[] {
	const options = flag?.state === 'open' ? (flag.options ?? []) : [];
	return options
		.map((option, index) => ({ number: index + 1, option }))
		.sort(
			(a, b) =>
				Number(Boolean(b.option.recommended)) - Number(Boolean(a.option.recommended)) ||
				a.number - b.number
		);
}

/** The answer write for a tapped option, or null when the review gate or the number refuses it. */
/** A written answer against the reviewed revision, or nothing when the item no longer admits it. */
export function writtenAnswer(
	detail: InboxDetail,
	reviewed: InboxReview,
	answer: string
): ConfirmedWrite | null {
	if (!writeGate('answer', detail, reviewed).allowed) return null;
	const { revision } = reviewed;
	return confirmedWrite({ action: 'answer', id: detail.header.id, text: answer, revision }, true);
}

export function optionWrite(
	detail: InboxDetail,
	reviewed: { revision: string | null } | null,
	number: number
): ConfirmedWrite | null {
	const chosen = orderedOptions(detail.flag).find((entry) => entry.number === number);
	if (!chosen || !writeGate('answer', detail, reviewed).allowed) return null;
	return confirmedWrite(
		{
			action: 'answer',
			id: detail.header.id,
			text: chosen.option.label,
			revision: reviewed?.revision ?? null,
			option: number
		},
		true
	);
}
