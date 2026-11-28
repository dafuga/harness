// @harness-uid u_bl6xl2h4a3
import { attemptKey } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { WatchdogStartupService } from '../WatchdogStartupService';
import type { WatchdogScan } from '../WatchdogPaneService.types';
import type { TrackerHandoffTarget } from './trackerWatchdogContext.types';
import { readWatchdogAlerts } from './trackerHostWatchdogState';

export const urgentQueueAlertKind = 'urgent-launch-queue-stuck';

export function recordStartupAlerts(
	store: TrackerPersistenceService,
	snapshot: WatchdogScan,
	startup: WatchdogStartupService
): void {
	const previousAlerts = Object.values(readWatchdogAlerts(store))
		.filter(({ kind }) => kind === 'startup')
		.map(({ item_id, reason, identity }) => ({ id: item_id, reason, identity }));
	const plan = startup.plan({ ...snapshot, previousAlerts });
	for (const action of plan.actions) {
		if (action.action !== 'alert' || !action.writeAlert) continue;
		recordWatchdogAlert(
			store,
			{
				itemId: action.id,
				kind: 'startup',
				reason: action.reason,
				session: action.pane,
				identity: action.identity
			},
			snapshot.now
		);
	}
	for (const cleared of plan.clearAlerts) clearStartupAlert(store, cleared);
}

function clearStartupAlert(
	store: TrackerPersistenceService,
	{ id, clearQuestion }: { id: string; clearQuestion: boolean }
): void {
	const alerts = readWatchdogAlerts(store);
	delete alerts[`${id}:startup`];
	const persist = () => store.writeMeta({ watchdog_alerts: JSON.stringify(alerts) });
	if (clearQuestion)
		store.appendLocal({ itemId: id, fields: { needs_daniel: 0, question: null } }, persist);
	else persist();
}

/**
 * Record one alert on the Chief of Staff channel (`needs-attention` and the CoS tick), with a note
 * on the item. It never asks Daniel. An alert that must stop relaunches blocks the item instead.
 */
export function recordWatchdogAlert(
	store: TrackerPersistenceService,
	input: {
		itemId: string;
		kind: string;
		reason: string;
		identity: string;
		session?: string | null;
		key?: string;
		host?: string;
		localOnly?: boolean;
		persist?: () => void;
	},
	at: number,
	hold?: string
): void {
	const { itemId, kind, reason, identity, session, localOnly } = input;
	const key = input.key ?? `${itemId}:${kind}`;
	const alerts = readWatchdogAlerts(store);
	if (alerts[key]?.identity === identity && alerts[key]?.reason === reason) return;
	const alert = {
		id: `${store.node}:${key}:${at}`,
		item_id: itemId,
		kind,
		host: input.host ?? store.node,
		session,
		reason,
		identity,
		at
	};
	const fields = {
		'note+': `watchdog ${kind}: ${reason}`,
		...(hold && { status: 'blocked', blocked_reason: hold })
	};
	const persist = () => {
		store.writeMeta({ watchdog_alerts: JSON.stringify({ ...alerts, [key]: alert }) });
		input.persist?.();
	};
	if (localOnly) persist();
	else store.appendLocal({ itemId, fields }, persist);
}
export function contextAlert(
	store: TrackerPersistenceService,
	target: TrackerHandoffTarget,
	now: number,
	detail: string
) {
	const { pane, id } = target;
	const reason = `Session ${pane.name} exceeded 150,000 active context tokens. ${detail}`;
	recordWatchdogAlert(
		store,
		{ itemId: id, session: pane.name, kind: 'context', reason, identity: pane.key },
		now
	);
}

export function recordOverdueAlert(
	store: TrackerPersistenceService,
	run: TrackerRunReceipt,
	{ reason, at }: { reason: string; at: number }
) {
	const stop = `tracker stop ${run.item_id.slice(0, 6)}`;
	recordWatchdogAlert(
		store,
		{
			itemId: run.item_id,
			kind: 'overdue',
			reason: `Run #${run.id} ${reason}. No retry is queued. Check the session, or end it with \`${stop}\`.`,
			identity: attemptKey(run),
			session: run.tmux
		},
		at
	);
}

export function blockMissingItem(
	store: TrackerPersistenceService,
	{ item, candidate, reason }: { item: TrackerItem; candidate?: TrackerItem; reason: string }
) {
	if (candidate?.auto !== item.auto || candidate?.updated_at !== item.updated_at) return;
	store.commitLocal(() => {
		if (
			item.status !== 'in_progress' &&
			!(item.status === 'open' && item.launch_source === 'recovery')
		)
			return { result: false };
		const history = new TrackerRunReadRepository(store.database, store.node).list({
			itemId: item.id
		});
		if (history.some(({ state }) => state !== 'finished')) return { result: false };
		return {
			result: true,
			operation: {
				itemId: item.id,
				fields: {
					status: 'blocked',
					blocked_reason: reason,
					'note+': `Tracker recovery held: ${reason}`
				}
			}
		};
	});
}
