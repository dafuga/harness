// @harness-uid u_xba7ieg4je
import { trackerScheduleHold } from '../../../utils/projects-sessions/trackerScheduleHold';
import { trackerAttachments } from '../../../utils/projects-sessions/trackerAttachments';
import { trackerItemPriority } from '../../../utils/projects-sessions/trackerItemPriority';
import type { SqliteStatement } from '../../../core/development-tooling/sqliteTypes';
import type {
	TrackerDigestItem,
	TrackerItem,
	TrackerItemRow
} from '../TrackerItemReadRepository.types';
import type { StoredTrackerCallback, StoredTrackerNote } from './serializeTrackerItem.types';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import {
	trackerPlanning,
	trackerPlanningStage
} from '../../../utils/projects-sessions/trackerPlanning';
import { trackerAskOptions } from '../../../utils/projects-sessions/trackerAskOptions';
import { TrackerItemReadError } from './TrackerItemReadError';

/** Shape an item for public reads. SQLite-only fields and callback targets stay private. */
export function serializeTrackerItem(
	row: TrackerItemRow,
	notes: SqliteStatement,
	now: number
): TrackerItem {
	return {
		id: row.id,
		...itemClassification(row),
		title: row.title,
		status: row.status,
		stage: trackerPlanningStage(row),
		planning: trackerPlanning(row),
		blocked_reason: row.status === 'blocked' ? row.blocked_reason : null,
		...ignoredFields(row),
		...trackerChaseFields(row),
		...(row.next_step && { next_step: row.next_step }),
		...(row.parked_until && { parked_until: row.parked_until }),
		due: row.due,
		remind_at: nullIfEmpty(row.remind_at),
		auto: nullIfEmpty(row.auto),
		project: nullIfEmpty(row.project),
		repo: nullIfEmpty(row.repo),
		computer: nullIfEmpty(row.computer),
		...launchFields(row, now),
		model: nullIfEmpty(row.model),
		sensitive: Boolean(Number(row.sensitive)),
		recurring: Boolean(row.every),
		every: nullIfEmpty(row.every),
		every_tz: row.every ? (nullIfEmpty(row.every_tz) ?? 'Europe/Lisbon') : null,
		occurrence: nullIfEmpty(row.occurrence),
		last_result: row.last_result ? JSON.parse(row.last_result) : null,
		missed: nullIfEmpty(row.missed),
		owner: row.owner,
		agent: row.agent,
		parent: row.parent,
		notes: row.notes,
		...(row.adapter_instructions ? { adapter_instructions: row.adapter_instructions } : {}),
		...(row.area_claim && { area_claim: row.area_claim }),
		notes_log: notesLog(row, notes),
		needs_daniel: Boolean(row.needs_daniel),
		question: row.question,
		...askFields(row),
		answer: row.answer,
		answered_at: row.answered_at,
		answered_by: row.answered_by,
		resolved: Boolean(row.resolved),
		callback: publicCallback(row.callback),
		created_at: row.created_at,
		created_by: row.created_by,
		updated_at: row.updated_at,
		deleted: Boolean(row.deleted)
	};
}

function launchFields(row: TrackerItemRow, now: number) {
	const hold = row.kind === 'reminder' ? null : trackerScheduleHold(row, now);
	return {
		launch_target: nullIfEmpty(row.launch_target),
		launch_source: nullIfEmpty(row.launch_source),
		launch_pick: nullIfEmpty(row.launch_pick),
		schedule_off: Boolean(hold) || (row.kind === 'reminder' && Number(row.schedule_off) === 1),
		...(hold && { schedule_hold: hold }),
		schedule_status: nullIfEmpty(row.schedule_status)
	};
}

export function trackerChaseFields(row: TrackerItemRow) {
	if (!row.chased_clock || !row.chased_count) return {};
	return {
		chased_at: new Date(hlcMilliseconds(row.chased_clock)).toISOString(),
		chased_by: row.chased_by ?? null,
		chased_reason: row.chased_reason ?? null,
		chased_count: row.chased_count
	};
}

export function trackerAskAge(row: TrackerItemRow, now: number) {
	const { needs_daniel } = JSON.parse(row.clocks) as { needs_daniel?: string };
	const at =
		trackerClockMilliseconds(needs_daniel ?? '') ||
		Date.parse(row.updated_at ?? row.created_at ?? '') ||
		now;
	return {
		asked_at: new Date(at).toISOString(),
		waiting_minutes: Math.max(0, Math.floor((now - at) / 60_000))
	};
}

function notesLog(row: TrackerItemRow, notes: SqliteStatement) {
	return (notes.all(row.id) as StoredTrackerNote[]).map(({ hlc, node, text }) => ({
		at: new Date(hlcMilliseconds(hlc)).toISOString(),
		node,
		text
	}));
}

/** What the digest shows of an open ask: how long it has waited, its choices and confirm kind. */
export function trackerAskFields(row: TrackerItemRow, open: boolean, now: number) {
	if (!open) return {};
	return {
		...trackerAskAge(row, now),
		...(row.options && { options: trackerAskOptions(row.options) }),
		...(row.confirm && { confirm: row.confirm }),
		...attachmentListing(row)
	};
}

/** Options travel only on asks that have them, so plain items keep their old shape. */
function askFields(row: TrackerItemRow) {
	const options = trackerAskOptions(row.options);
	return {
		...(options.length && { options }),
		...(options.length && row.needs_daniel && !row.resolved && { asked_at: askedAt(row) }),
		...(options.length && row.confirm && { confirm: row.confirm }),
		...(row.answer_option && { answer_option: Number(row.answer_option) }),
		...attachmentListing(row)
	};
}

/** Only the small listing is read out; documents are fetched one at a time. */
function attachmentListing(row: TrackerItemRow) {
	const attachments = trackerAttachments(row.attachments);
	return attachments.length ? { attachments } : {};
}

function askedAt(row: TrackerItemRow) {
	return trackerAskAge(row, 0).asked_at;
}

function ignoredFields(row: TrackerItemRow) {
	if (row.status !== 'ignored') return {};
	return {
		ignored_reason: row.ignored_reason,
		ignored_by: row.ignored_by,
		ignored_at: row.ignored_at,
		ignored_until: nullIfEmpty(row.ignored_until)
	};
}

function nullIfEmpty(value: string | null): string | null {
	return value === '' ? null : value;
}

function hlcMilliseconds(hlc: string): number {
	const match = /^(\d{15})-\d{6}-.+$/.exec(hlc);
	return match ? Number(match[1]) : 0;
}

function publicCallback(raw: string | null): TrackerItem['callback'] {
	if (!raw) return null;
	let callback: StoredTrackerCallback | null;
	try {
		callback = JSON.parse(raw);
	} catch {
		// Native JSON errors can contain part of the stored command or URL.
		throw new TrackerItemReadError('Invalid Tracker callback metadata', 500);
	}
	if (!callback) return null;
	return { target: callback.url ? webhookLabel(callback.url) : 'command', node: callback.node };
}

function webhookLabel(url: string): string {
	try {
		return `webhook ${new URL(url).host}`;
	} catch {
		return 'webhook';
	}
}

function itemClassification({ kind, priority }: TrackerItemRow) {
	return { kind, priority: trackerItemPriority(priority, 'normal') };
}

export function openLaunchHold(row: TrackerItemRow, item: TrackerDigestItem, now: number) {
	if (
		row.status !== 'open' ||
		(row.kind ?? 'task') !== 'task' ||
		row.every ||
		item.needs_daniel ||
		row.auto
	)
		return undefined;
	const hold = trackerScheduleHold(row, now);
	return hold ? { ...item, ...hold } : undefined;
}
