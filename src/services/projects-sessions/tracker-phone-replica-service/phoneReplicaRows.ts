// @harness-uid u_st4dufvqxm
import { isPrivateTrackerReviewNote } from '../../../utils/projects-sessions/isTrackerBlockedOnDaniel';
import { phoneAskAttachments } from './phoneAskAttachments';
import { trackerStructuredAsk } from '../../../utils/projects-sessions/trackerStructuredAsk';
import { trackerAskOptions } from '../../../utils/projects-sessions/trackerAskOptions';
import { createHash } from 'node:crypto';
import {
	trackerReminderGroup,
	trackerUpcomingReminder
} from '../../../utils/projects-sessions/trackerUpcomingReminder';
import { trackerPersonalAgent } from '../../../utils/projects-sessions/trackerUnattendedHold';
import { itemSql, noteSql } from './phoneReplicaQueries';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { sanitizeTrackerText } from '../../../utils/projects-sessions/sanitizeTrackerText';
import {
	trackerPlanning,
	trackerPlanningStage
} from '../../../utils/projects-sessions/trackerPlanning';
import type {
	PhoneItemSource,
	PhoneNoteSource,
	PhoneRunSource,
	PhoneTrackerRow
} from './phoneReplicaRows.types';

const day = 86_400_000;
const outcomes = new Set(['done', 'failed', 'rejected', 'blocked', 'timed_out', 'abandoned']);

export function phoneReplicaRows(db: SqliteDatabase, node: string, now: number): PhoneTrackerRow[] {
	const items = db
		.prepare(itemSql)
		.all(new Date(now - 30 * day).toISOString()) as PhoneItemSource[];
	const notes = db.prepare(noteSql);
	const runs = phoneRuns(
		db,
		node,
		items.map(({ id }) => id)
	);
	return items.map((item) =>
		projectItem(item, notes.all(item.id) as PhoneNoteSource[], runs.get(item.id) ?? [], now)
	);
}

/** The write path uses exactly the same retention and visibility rules as the feed. */
export function readPhoneReplicaItem(db: SqliteDatabase, id: string, now: number) {
	return db
		.prepare(`SELECT * FROM (${itemSql}) WHERE id = ?`)
		.get(new Date(now - 30 * day).toISOString(), id) as PhoneItemSource | undefined;
}

/** An opaque revision changes on a replacement question, flag or answer. */
export function attentionRevision(item: PhoneItemSource): string {
	return createHash('sha256')
		.update(
			JSON.stringify([
				item.attention_clock,
				item.question,
				item.needs_daniel,
				item.resolved,
				...(item.options ? [item.options] : []),
				...(item.attachments ? [item.attachments] : []),
				// A reminder that moved makes an earlier Done or Snooze stale.
				...(trackerReminderGroup(reminderSource(item)) && item.remind_at ? [item.remind_at] : [])
			])
		)
		.digest('hex');
}

function projectItem(
	item: PhoneItemSource,
	notes: PhoneNoteSource[],
	runs: PhoneRunSource[],
	now: number
): PhoneTrackerRow {
	const reminder = trackerUpcomingReminder(reminderSource(item), now);
	return {
		id: item.id,
		...(reminder && { reminder }),
		title: excerpt(item.title, 240),
		project: excerpt(item.project, 120),
		status: item.status,
		stage: trackerPlanningStage(item),
		planning: trackerPlanning(item),
		updatedAt: phoneDate(item.updated_at),
		dueAt: phoneDate(item.due),
		attentionRevision: attentionRevision(item),
		notes: notes
			.filter(({ text }) => !isPrivateTrackerReviewNote(text))
			.map(({ hlc, author, text }) => ({
				id: createHash('sha256').update(hlc).digest('hex'),
				author: excerpt(author, 80),
				at: clockTime(hlc) ?? '1970-01-01T00:00:00.000Z',
				text: excerpt(text, 512)
			})),
		flag:
			item.needs_daniel || item.resolved
				? {
						state: item.resolved ? 'resolved' : 'open',
						at: clockTime(item.flag_clock),
						question: excerpt(item.question, 512),
						...phoneAskChoices(item),
						...(!trackerPersonalAgent(item.agent) &&
							trackerStructuredAsk(item) &&
							phoneAskAttachments(item))
					}
				: null,
		runs: runs.map((run) => ({
			id: run.id,
			origin: excerpt(run.origin, 80),
			state: run.state,
			outcome: run.outcome && outcomes.has(run.outcome) ? run.outcome : null,
			queuedAt: run.queued_at,
			startedAt: run.started_at,
			endedAt: run.ended_at
		}))
	};
}

/** Choices travel only on a structured ask: the phone counts and offers exactly those. */
function phoneAskChoices(item: PhoneItemSource) {
	// A personal item is never a "Needs you" ask, so its choices stay on the computer.
	if (trackerPersonalAgent(item.agent) || !trackerStructuredAsk(item)) return {};
	const options = trackerAskOptions(item.options);
	return {
		options: options.map(({ label, effect, recommended }) => ({
			label: excerpt(label, 80),
			effect: excerpt(effect, 400),
			...(recommended && { recommended: true as const })
		})),
		...(item.confirm && { confirm: item.confirm })
	};
}

function reminderSource(item: PhoneItemSource) {
	return { ...item, remindAt: item.remind_at, autoLaunch: Boolean(item.auto_launch) };
}

function excerpt(value: string | null, bytes: number): string {
	const safe = Buffer.from(sanitizeTrackerText(value ?? '').replace(/\p{C}/gu, ' '));
	if (safe.length <= bytes) return safe.toString();
	return safe
		.subarray(0, bytes)
		.toString()
		.replace(/\uFFFD$/, '');
}

function phoneDate(input: string | null): string | null {
	if (!input || input.length > 40 || !/^\d{4}-\d{2}-\d{2}(?:$|T[0-9:.+Z-]+$)/.test(input))
		return null;
	return Number.isFinite(Date.parse(input)) ? input : null;
}

function clockTime(clock: string | null): string | null {
	const match = /^(\d{15})-\d{6}-/.exec(clock ?? '');
	return match ? new Date(Number(match[1])).toISOString() : null;
}

function phoneRuns(db: SqliteDatabase, node: string, items: string[]) {
	const byItem = new Map<string, PhoneRunSource[]>();
	const has = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?");
	const select = ['runs', 'remote_runs']
		.filter((name) => has.get(name))
		.map(
			(name) => `
		SELECT item_id, cast(id AS TEXT) AS id, ${name === 'runs' ? '(SELECT node FROM target)' : 'node'} AS origin,
			state, outcome, queued_at, started_at, ended_at
		FROM ${name} WHERE item_id IN (SELECT value FROM json_each((SELECT items FROM target)))
			AND state IN ('queued', 'running', 'verifying', 'observed', 'finished')
	`
		);
	if (!items.length || !select.length) return byItem;
	const rows = db
		.prepare(
			`
		WITH target(node, items) AS (VALUES (?, ?)),
			history AS (${select.join(' UNION ALL ')}),
			ordered AS (
				SELECT *, row_number() OVER (
					PARTITION BY item_id ORDER BY queued_at DESC, origin, cast(id AS INTEGER) DESC
				) AS position FROM history
			)
		SELECT * FROM ordered WHERE position <= 5 ORDER BY item_id, position
	`
		)
		.all(node, JSON.stringify(items)) as PhoneRunSource[];
	for (const run of rows) {
		const retained = byItem.get(run.item_id) ?? [];
		retained.push(run);
		byItem.set(run.item_id, retained);
	}
	return byItem;
}
