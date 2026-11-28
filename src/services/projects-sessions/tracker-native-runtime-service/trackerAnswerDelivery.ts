// @harness-uid u_bl6xl2h4a3
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { hubMessageLine } from '../../../utils/projects-sessions/hubSessionMessages';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type { PendingTrackerAnswer, TrackerAnswerAttempt } from './trackerAnswerDelivery.types';

const pollInterval = 15_000;
const alertGrace = 2 * 60_000;
const remoteAlertGrace = 10 * 60_000;
const receiptPrefix = 'Tracker answer ';
const alertKind = 'answer-delivery';

export function trackerAnswerDelivery(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	now: () => number,
	chiefOfStaff: boolean
) {
	const runs = new TrackerRunReadRepository(store.database, store.node);
	let lastPoll = -Infinity;
	return async (signal: AbortSignal) => {
		const at = now();
		if (at - lastPoll < pollInterval) return;
		lastPoll = at;
		const pending = pendingAnswers(store);
		clearResolvedAnswerAlerts(store, pending);
		for (const answer of pending) {
			signal.throwIfAborted();
			const history = runs
				.list({ itemId: answer.id })
				.filter(({ started_at }) => started_at != null);
			const run = history.at(-1);
			const answeredAt = Date.parse(answer.answeredAt);
			if (!run || !history.some(({ started_at }) => started_at! <= answeredAt)) continue;
			if (run.node !== store.node && !chiefOfStaff) continue;
			await deliverAnswer(store, driver, { answer, run, at, answeredAt }, signal);
		}
	};
}

/** Read the current answer generation. A replaced ask or a closed item has nothing to deliver. */
function pendingAnswers(store: TrackerPersistenceService) {
	return store.database
		.prepare(
			`SELECT i.id, i.chief_answer IS NOT NULL AS privateReview, i.answered_at AS answeredAt, json_extract(i.clocks, '$.answer') AS generation,
				CASE WHEN i.chief_answer IS NULL AND i.answer_option IS NOT NULL AND coalesce(i.confirm,'') <> 'secret'
					AND cast(coalesce(i.sensitive,0) AS INTEGER) = 0 THEN i.answer END AS choice,
				(i.status = 'blocked' AND json_extract(i.clocks,'$.status') >= json_extract(i.clocks,'$.answer'))
					AS keepBlocked
			FROM items i
			WHERE i.deleted = 0 AND coalesce(i.kind,'task') = 'task'
				AND (i.status IN ('open','in_progress','blocked') OR (i.status = 'done' AND i.chief_answer IS NOT NULL))
				AND i.resolved = 1 AND i.needs_daniel = 0 AND i.answered_at IS NOT NULL
				AND json_extract(i.clocks,'$.answer') = json_extract(i.clocks,'$.answered_at')
				AND json_extract(i.clocks,'$.answer') > coalesce(json_extract(i.clocks,'$.question'),'')
				AND NOT EXISTS (SELECT 1 FROM item_notes n WHERE n.item_id = i.id
					AND instr(n.text, ? || json_extract(i.clocks,'$.answer') || ' delivered to ') = 1)`
		)
		.all(receiptPrefix) as PendingTrackerAnswer[];
}

function clearResolvedAnswerAlerts(
	store: TrackerPersistenceService,
	pending: PendingTrackerAnswer[]
) {
	const generations = new Map(pending.map(({ id, generation }) => [id, generation]));
	const alerts = Object.entries(readWatchdogAlerts(store));
	const retained = alerts.filter(
		([, alert]) => alert.kind !== alertKind || generations.get(alert.item_id) === alert.identity
	);
	if (alerts.length !== retained.length)
		store.writeMeta({ watchdog_alerts: JSON.stringify(Object.fromEntries(retained)) });
}

function recordedPaneKey(store: TrackerPersistenceService, runId: number): string | undefined {
	const row = store.database
		.prepare(
			`SELECT coalesce(r.watch_pane,
		json_extract(m.v, '$.hostSessionId')) AS key
		FROM runs r LEFT JOIN meta m ON m.k = 'harness_dispatch_run:' || r.id
		WHERE r.id = ?`
		)
		.get(runId) as { key: string | null } | undefined;
	return row?.key?.includes(':%') ? row.key : undefined;
}

async function deliverAnswer(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	{ answer, run, at, answeredAt }: TrackerAnswerAttempt,
	signal: AbortSignal
) {
	const { id, generation } = answer;
	const local = run.node === store.node;
	if (local && (await submitAnswer(store, driver, { answer, run }, signal))) {
		store.appendLocal({
			itemId: id,
			actor: 'Tracker',
			fields: {
				'note+': `${receiptPrefix}${generation} delivered to ${run.tmux} on ${store.node} (run #${run.id}).`
			}
		});
		return;
	}
	if (answer.keepBlocked && run.state === 'finished') return;
	if (at - answeredAt < (local ? alertGrace : remoteAlertGrace)) return;
	recordWatchdogAlert(
		store,
		{
			itemId: id,
			kind: alertKind,
			identity: generation,
			host: run.node,
			session: run.tmux,
			reason: `The recorded answer has no delivery receipt from run #${run.id} on ${run.node}. Tracker will retry when an eligible pane is available. Chief of Staff, check the session or its relaunch.`
		},
		at
	);
}

async function submitAnswer(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	{ answer, run }: Pick<TrackerAnswerAttempt, 'answer' | 'run'>,
	signal: AbortSignal
) {
	const live = run.state === 'running' || run.state === 'observed' || run.outcome === 'blocked';
	const { tmux, cli, started_at: startedAt } = run;
	if (!live || !tmux || startedAt == null || (cli !== 'codex' && cli !== 'claude')) return false;
	const result = await driver
		.deliver?.(
			{
				session: tmux,
				message: answerPrompt(answer),
				expected: { startedAt, cli, key: recordedPaneKey(store, run.id) }
			},
			signal
		)
		.catch(() => undefined);
	signal.throwIfAborted();
	return result === 'delivered';
}

function answerPrompt({ id, answeredAt, choice, privateReview }: PendingTrackerAnswer) {
	const selected = choice && hubMessageLine(choice.slice(0, 160));
	return (
		`Tracker answer for item ${id} at ${answeredAt}.` +
		(selected ? ` Selected option: ${selected}. ` : ' ') +
		(privateReview
			? `Read the Chief of Staff answer with tracker review ${id} and continue as directed. Handle credentials through the approved private path.`
			: 'Read the current answer on the Tracker item and continue as directed. Handle credentials through the approved private path.')
	);
}
