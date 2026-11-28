// @harness-uid u_bl6xl2h4a3
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { hubMessageLine } from '../../../utils/projects-sessions/hubSessionMessages';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
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
	const currentAlert = (alert: TrackerWatchdogAlert) => {
		if (alert.kind !== alertKind) return true;
		const [answer] = pendingAnswers(store, alert.item_id);
		return (
			answer?.generation === alert.identity && matchesAnswerRun(alert, answerRun(runs, answer))
		);
	};
	return {
		currentAlert,
		async poll(signal: AbortSignal) {
			const at = now();
			if (at - lastPoll < pollInterval) return;
			lastPoll = at;
			clearResolvedAnswerAlerts(store, currentAlert);
			for (const answer of pendingAnswers(store)) {
				signal.throwIfAborted();
				const run = answerRun(runs, answer);
				if (!run) continue;
				if (run.state === 'finished') {
					if (run.node === store.node) recordNoLiveDelivery(store, answer, run);
					continue;
				}
				if (!liveAnswerRun(run) || (run.node !== store.node && !chiefOfStaff)) continue;
				await deliverAnswer(store, driver, { answer, run, at }, signal);
			}
		}
	};
}

function answerRun(runs: TrackerRunReadRepository, answer: PendingTrackerAnswer) {
	const history = runs.list({ itemId: answer.id }).filter(({ started_at }) => started_at != null);
	const answeredAt = Date.parse(answer.answeredAt);
	return history.some(({ started_at }) => started_at! <= answeredAt) ? history.at(-1) : undefined;
}

function liveAnswerRun(run: TrackerAnswerAttempt['run']) {
	return run.ended_at == null && (run.state === 'running' || run.state === 'observed');
}

function matchesAnswerRun(
	alert: TrackerWatchdogAlert,
	run: TrackerAnswerAttempt['run'] | undefined
) {
	return (
		!!run &&
		liveAnswerRun(run) &&
		run.node === alert.host &&
		run.tmux === alert.session &&
		run.started_at! <= alert.at
	);
}

/** Read the current answer generation. A replaced ask or a closed item has nothing to deliver. */
function pendingAnswers(store: TrackerPersistenceService, itemId?: string) {
	const itemFilter = itemId === undefined ? '' : 'AND i.id = ?';
	return store.database
		.prepare(
			`SELECT i.id, i.answered_at AS answeredAt, json_extract(i.clocks, '$.answer') AS generation,
				CASE WHEN i.answer_option IS NOT NULL AND coalesce(i.confirm,'') <> 'secret'
					AND cast(coalesce(i.sensitive,0) AS INTEGER) = 0 THEN i.answer END AS choice
			FROM items i
			WHERE i.deleted = 0 AND coalesce(i.kind,'task') = 'task'
				AND i.status IN ('open','in_progress','blocked')
				AND i.resolved = 1 AND i.needs_daniel = 0 AND i.answered_at IS NOT NULL
				AND json_extract(i.clocks,'$.answer') = json_extract(i.clocks,'$.answered_at')
				AND json_extract(i.clocks,'$.answer') > coalesce(json_extract(i.clocks,'$.question'),'')
				AND NOT EXISTS (SELECT 1 FROM item_notes n WHERE n.item_id = i.id
					AND instr(n.text, ? || json_extract(i.clocks,'$.answer') || ' delivered to ') = 1)
				${itemFilter}`
		)
		.all(receiptPrefix, ...(itemId === undefined ? [] : [itemId])) as PendingTrackerAnswer[];
}

function clearResolvedAnswerAlerts(
	store: TrackerPersistenceService,
	currentAlert: (alert: TrackerWatchdogAlert) => boolean
) {
	const alerts = Object.entries(readWatchdogAlerts(store));
	const retained = alerts.filter(([, alert]) => currentAlert(alert));
	if (alerts.length !== retained.length)
		store.writeMeta({ watchdog_alerts: JSON.stringify(Object.fromEntries(retained)) });
}

/** Keep the answer eligible for a later launch or a blocked run that becomes live again. */
function recordNoLiveDelivery(
	store: TrackerPersistenceService,
	{ id, generation }: PendingTrackerAnswer,
	run: TrackerAnswerAttempt['run']
) {
	const note = `${receiptPrefix}${generation}: no live delivery needed (run #${run.id} on ${run.node} ended).`;
	if (
		store.database.prepare('SELECT 1 FROM item_notes WHERE item_id = ? AND text = ?').get(id, note)
	)
		return;
	store.appendLocal({ itemId: id, actor: 'Tracker', fields: { 'note+': note } });
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
	{ answer, run, at }: TrackerAnswerAttempt,
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
	if (at - Date.parse(answer.answeredAt) < (local ? alertGrace : remoteAlertGrace)) return;
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
	const { tmux, cli, started_at: startedAt } = run;
	if (!tmux || startedAt == null || (cli !== 'codex' && cli !== 'claude')) return false;
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

function answerPrompt({ id, answeredAt, choice }: PendingTrackerAnswer) {
	const selected = choice && hubMessageLine(choice.slice(0, 160));
	return (
		`Tracker answer for item ${id} at ${answeredAt}.` +
		(selected ? ` Selected option: ${selected}. ` : ' ') +
		'Read the current answer on the Tracker item and continue as directed. Handle credentials through the approved private path.'
	);
}
