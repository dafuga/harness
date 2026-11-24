// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchItem,
	TrackerDispatchWrites,
	TrackerLaunchIntent,
	TrackerRunReceipt
} from '../../../services/agents-providers/TrackerDispatcherService.types';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerDispatchRow } from '../TrackerDispatchRepository.types';

export function dispatchItem(
	row: TrackerDispatchRow,
	runs: readonly TrackerRunReceipt[]
): TrackerDispatchItem {
	const clocks = JSON.parse(row.clocks) as Record<string, string>;
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
		scheduleOff: flag(row.schedule_off),
		deleted: Boolean(row.deleted),
		awaitingAnswer: Boolean(row.needs_daniel && !row.resolved),
		answeredCurrentBlock: answeredBlock(row, clocks, runs),
		blockedReason: row.blocked_reason,
		closedBySource: flag(row.adapter_closed),
		completionVersion: clocks.status,
		updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
		launch: launchIntent(row)
	};
}

function flag(value: string | null): boolean {
	return Number(value) === 1;
}

function launchIntent(row: TrackerDispatchRow): TrackerLaunchIntent | null {
	if (!row.auto) return null;
	return {
		token: row.auto,
		source: row.launch_source === 'due' ? 'due' : 'manual',
		target:
			(row.launch_target ?? row.computer) === 'auto' ? null : (row.launch_target ?? row.computer),
		...(row.launch_pick && { scheduledPick: JSON.parse(row.launch_pick) }),
		...(row.launch_hold && { hold: JSON.parse(row.launch_hold) })
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
		launch_pick: jsonOrNull(intent?.scheduledPick),
		launch_hold: jsonOrNull(intent?.hold)
	};
}

function jsonOrNull(value: unknown): string | null {
	return value ? JSON.stringify(value) : null;
}

export function dispatchJournalFields(item: NonNullable<TrackerDispatchWrites['item']>) {
	const fields: Record<string, unknown> = {};
	for (const key of ['computer', 'project', 'repo', 'model', 'sensitive', 'status'] as const) {
		if (item[key] !== undefined) fields[key] = item[key];
	}
	if (item.launch !== undefined) Object.assign(fields, launchJournalFields(item.launch));
	if (item.blockedReason !== undefined) fields.blocked_reason = item.blockedReason;
	if (item.awaitingAnswer !== undefined) fields.needs_daniel = item.awaitingAnswer;
	if (item.answeredCurrentBlock === false) fields.resolved = false;
	return fields;
}
