// @harness-uid u_xba7ieg4je
import type { SqliteStatement } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerItem, TrackerItemRow } from '../TrackerItemReadRepository.types';
import type { StoredTrackerCallback, StoredTrackerNote } from './serializeTrackerItem.types';
import { TrackerItemReadError } from './TrackerItemReadError';

/** Shape an item for public reads. SQLite-only fields and callback targets stay private. */
export function serializeTrackerItem(row: TrackerItemRow, notes: SqliteStatement): TrackerItem {
	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		status: row.status,
		blocked_reason: row.status === 'blocked' ? row.blocked_reason : null,
		...ignoredFields(row),
		...trackerChaseFields(row),
		due: row.due,
		remind_at: nullIfEmpty(row.remind_at),
		auto: nullIfEmpty(row.auto),
		project: nullIfEmpty(row.project),
		repo: nullIfEmpty(row.repo),
		computer: nullIfEmpty(row.computer),
		launch_target: nullIfEmpty(row.launch_target),
		launch_source: nullIfEmpty(row.launch_source),
		launch_pick: nullIfEmpty(row.launch_pick),
		schedule_off: Boolean(Number(row.schedule_off)),
		schedule_status: nullIfEmpty(row.schedule_status),
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
		notes_log: (notes.all(row.id) as StoredTrackerNote[]).map(({ hlc, node, text }) => ({
			at: new Date(hlcMilliseconds(hlc)).toISOString(),
			node,
			text
		})),
		needs_daniel: Boolean(row.needs_daniel),
		question: row.question,
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

export function trackerChaseFields(row: TrackerItemRow) {
	if (!row.chased_clock || !row.chased_count) return {};
	return {
		chased_at: new Date(hlcMilliseconds(row.chased_clock)).toISOString(),
		chased_by: row.chased_by ?? null,
		chased_reason: row.chased_reason ?? null,
		chased_count: row.chased_count
	};
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
