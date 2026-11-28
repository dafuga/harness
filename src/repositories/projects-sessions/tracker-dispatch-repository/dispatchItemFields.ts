// @harness-uid u_ksy76trvsj
import { isTrackerAwaitingAnswer } from '../../../utils/projects-sessions/isTrackerAwaitingAnswer';
import {
	describeTrackerScheduleHold,
	trackerScheduleHold
} from '../../../utils/projects-sessions/trackerScheduleHold';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type {
	TrackerDispatchItem,
	TrackerDispatchSnapshot,
	TrackerDispatchWrites,
	TrackerLaunchIntent,
	TrackerRunReceipt
} from '../../../services/agents-providers/TrackerDispatcherService.types';
import {
	canonicalNode,
	schedulingHold
} from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerItem } from '../TrackerItemReadRepository.types';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerDispatchRow } from '../TrackerDispatchRepository.types';

export function dispatchItem(
	row: TrackerDispatchRow,
	runs: readonly TrackerRunReceipt[],
	now: number
): TrackerDispatchItem {
	const clocks = JSON.parse(row.clocks) as Record<string, string>;
	const hold = trackerScheduleHold(row, now);
	return {
		id: row.id,
		title: row.title ?? '',
		status: (row.status ?? 'open') as TrackerDispatchItem['status'],
		kind: row.kind ?? 'task',
		notes: row.notes,
		owner: row.owner,
		agent: row.agent,
		due: row.due,
		project: row.project,
		repo: row.repo,
		computer: row.computer,
		model: row.model,
		sensitive: flag(row.sensitive),
		createdBy: row.created_by ?? undefined,
		adapterDueOwner: row.adapter_due_owner,
		recurring: Boolean(row.every),
		scheduleOff: Boolean(hold),
		...(hold && { scheduleHoldReason: describeTrackerScheduleHold(hold) }),
		deleted: Boolean(row.deleted),
		awaitingAnswer: isTrackerAwaitingAnswer({ ...row, review_status: row.chief_review }),
		parkedUntil: Date.parse(row.parked_until ?? ''),
		question: row.question,
		answeredCurrentBlock: answeredBlock(row, clocks, runs),
		blockedReason: row.blocked_reason,
		closedBySource: flag(row.adapter_closed),
		completionVersion: clocks.status,
		updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
		launch: launchIntent(row)
	};
}

/** The journal clock of the current completion, while the item is done and its source is open. */
export function trackerCompletionVersion(database: SqliteDatabase, id: string): string | undefined {
	const row = database
		.prepare(
			`SELECT clocks FROM items WHERE id = ? AND status = 'done' AND deleted = 0
			AND coalesce(adapter_closed, 0) <> 1`
		)
		.get(id) as { clocks: string } | undefined;
	return row && (JSON.parse(row.clocks) as Record<string, string>).status;
}

function flag(value: string | null): boolean {
	return Number(value) === 1;
}

function launchIntent(row: TrackerDispatchRow): TrackerLaunchIntent | null {
	if (!row.auto) return null;
	return {
		token: row.auto,
		source: row.dispatch_source,
		target:
			(row.launch_target ?? row.computer) === 'auto' ? null : (row.launch_target ?? row.computer),
		...(row.launch_pick && { scheduledPick: JSON.parse(row.launch_pick) })
	};
}

function answeredBlock(
	row: TrackerDispatchRow,
	clocks: Record<string, string>,
	runs: readonly TrackerRunReceipt[]
): boolean {
	const answer = clocks.answer ?? '';
	const status = clocks.status ?? '';
	if (!hasRecentAnswer(row, answer, clocks.question ?? '')) return false;
	if (row.status === 'blocked') return answer > status;
	if (
		row.status !== 'in_progress' ||
		(row.blocked_reason && answer <= (clocks.blocked_reason ?? ''))
	)
		return false;
	const ended = Math.max(
		0,
		...runs.filter((run) => run.outcome === 'blocked').map((run) => run.ended_at ?? 0)
	);
	return Math.max(trackerClockMilliseconds(answer), trackerClockMilliseconds(status)) >= ended;
}

function hasRecentAnswer(row: TrackerDispatchRow, answer: string, question: string): boolean {
	return Boolean(row.answered_at && row.resolved && !row.needs_daniel && answer > question);
}

function launchJournalFields(intent: TrackerLaunchIntent | null) {
	return {
		auto: intent?.token ?? null,
		launch_target: intent?.target ?? null,
		launch_source: intent?.source ?? null,
		launch_pick: intent?.scheduledPick ? JSON.stringify(intent.scheduledPick) : null
	};
}

/** A new question replaces the earlier ask, so its choices must not stay attached. */
function replacedAsk(question: string | null | undefined): Record<string, unknown> {
	return question ? { question, options: null, confirm: null } : {};
}

function launchRequestNote({ source, target, scheduledPick }: TrackerLaunchIntent) {
	if (source === 'manual') return `auto-launch requested on ${target}`;
	if (source !== 'due' || !scheduledPick) return undefined;
	const pick = [scheduledPick.rung.model, scheduledPick.rung.effort].filter(Boolean).join(':');
	return `due scheduler requested launch on ${target} (${pick})`;
}

export function dispatchJournalFields(item: NonNullable<TrackerDispatchWrites['item']>) {
	const fields = replacedAsk(item.question);
	for (const key of ['computer', 'project', 'repo', 'model', 'sensitive', 'status'] as const) {
		if (item[key] !== undefined) fields[key] = item[key];
	}
	if (item.launch !== undefined) Object.assign(fields, launchJournalFields(item.launch));
	const requested = item.launch && launchRequestNote(item.launch);
	if (requested) fields['note+'] = requested;
	if (item.appendNote) fields['note+'] = item.appendNote;
	if (item.blockedReason !== undefined) fields.blocked_reason = item.blockedReason;
	if (item.awaitingAnswer !== undefined) fields.needs_daniel = item.awaitingAnswer;
	if (item.answeredCurrentBlock === false) fields.resolved = false;
	return fields;
}

export function trackerStoredSchedulingHold(item: TrackerItem, now: number) {
	return schedulingHold(
		{
			title: item.title ?? '',
			kind: item.kind ?? 'task',
			status: item.status as TrackerDispatchItem['status'],
			agent: item.agent,
			owner: item.owner,
			deleted: item.deleted,
			awaitingAnswer: isTrackerAwaitingAnswer(item),
			scheduleOff: item.schedule_off,
			scheduleHoldReason: item.schedule_hold && describeTrackerScheduleHold(item.schedule_hold),
			recurring: item.recurring,
			parkedUntil: Date.parse(item.parked_until ?? '')
		},
		now
	);
}

// Older idle work and automatic creation wrote "manual". An explicit CLI launch
// journaled its launch note in the same operation that minted the token.
export const dispatchLaunchSource = `CASE
	WHEN i.launch_source IN ('due', 'recovery', 'automatic') THEN i.launch_source
	WHEN EXISTS (
		SELECT 1 FROM item_notes n WHERE n.item_id = i.id AND n.hlc = json_extract(i.clocks, '$.auto')
		AND n.text LIKE 'auto-launch requested on %'
	) THEN 'manual'
	ELSE 'automatic' END`;

export function canRequeueStoppedRun(snapshot: TrackerDispatchSnapshot, run: TrackerRunReceipt) {
	const { item, runs, openSession, activeSessionKeys } = snapshot;
	return (
		item?.status === 'in_progress' &&
		!item.launch &&
		item.scheduleOff &&
		!openSession &&
		!activeSessionKeys?.length &&
		!runs.some((entry) => entry !== run && entry.state !== 'finished')
	);
}

export function canMoveUnclaimedLaunch(
	snapshot: TrackerDispatchSnapshot,
	node: string,
	token: string,
	now: number
) {
	const { item, runs, openSession, activeSessionKeys } = snapshot;
	if (!item || !portableLaunchItem(item, now) || openSession || activeSessionKeys?.length)
		return false;
	return (
		ownsPortableLaunch(item, node, token) &&
		!runs.some((run) => run.auto_token === token || run.state !== 'finished')
	);
}

function ownsPortableLaunch(item: TrackerDispatchItem, node: string, token: string) {
	if (item.adapterDueOwner && canonicalNode(item.adapterDueOwner, {}) !== node) return false;
	const intent = item.launch;
	return (
		intent?.token === token &&
		(intent.source === 'due' || intent.source === 'automatic') &&
		intent.target !== null &&
		canonicalNode(intent.target, {}) === node
	);
}

function portableLaunchItem(item: TrackerDispatchItem, now: number) {
	return !item.sensitive && !item.repo && schedulingHold(item, now) === null;
}
