// @harness-uid u_bl6xl2h4a3
import { randomUUID } from 'node:crypto';
import type {
	TrackerDispatcherService,
	TrackerDispatchResult
} from '../../agents-providers/TrackerDispatcherService';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';
import { trackerSessionHealth } from './trackerSessionHealth';
import { flagRecoveryError, recoverTrackerSession } from './trackerSessionRecovery';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import type {
	TrackerSessionHealthIssue,
	TrackerWatchdogLaunch
} from './trackerSessionHealth.types';

const healthKinds = new Set(['missing', 'launch-stuck', 'orphan', 'finished']);

export function readTrackerSessionHealth(
	store: TrackerPersistenceService,
	items: readonly TrackerItem[],
	panes: readonly WatchdogPane[],
	now: number
) {
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const clocks = store.database.prepare('SELECT clocks FROM items WHERE id = ?');
	const links = store.database.prepare('SELECT v FROM meta WHERE k GLOB ?');
	return trackerSessionHealth({
		host: store.node,
		now,
		reportUnassigned: store.node === 'daniel-primary-mbp',
		items,
		panes,
		runs: (id) => runs.list({ itemId: id }),
		scheduleAt(id) {
			const row = clocks.get(id) as { clocks: string } | undefined;
			const { auto, status } = JSON.parse(row?.clocks ?? '{}') as Record<string, string>;
			return Math.max(trackerClockMilliseconds(auto ?? ''), trackerClockMilliseconds(status ?? ''));
		},
		linkedItems: (runId) =>
			(links.all(`${trackerSessionItemPrefix}${runId}:*`) as { v: string }[]).map(({ v }) => v)
	});
}

export async function applyTrackerSessionHealth(
	store: TrackerPersistenceService,
	issues: readonly TrackerSessionHealthIssue[],
	state: { now: number; items: readonly TrackerItem[]; launch?: TrackerWatchdogLaunch },
	signal: AbortSignal
) {
	// The hub delivers request-only alerts through the one-minute launch scan.
	const monitored = issues.filter(
		({ kind, identity }) => kind !== 'launch-stuck' || !identity.startsWith('request:')
	);
	const active = new Set(monitored.map(healthKey));
	const stored = readWatchdogAlerts(store);
	const existing = Object.entries(stored);
	const retained = existing.filter(
		([key, alert]) => !healthKinds.has(alert.kind) || active.has(key)
	);
	if (retained.length !== existing.length)
		store.writeMeta({ watchdog_alerts: JSON.stringify(Object.fromEntries(retained)) });
	for (const issue of monitored) {
		signal.throwIfAborted();
		await publishIssue(store, issue, state);
	}
}

async function publishIssue(
	store: TrackerPersistenceService,
	issue: TrackerSessionHealthIssue,
	{
		now,
		items,
		launch
	}: { now: number; items: readonly TrackerItem[]; launch?: TrackerWatchdogLaunch }
) {
	const candidate = items.find(({ id, deleted }) => id === issue.item_id && !deleted);
	const item = candidate && new TrackerItemReadRepository(store.database).getStored(candidate.id);
	if (launch && item?.launch_source === 'recovery' && issue.kind === 'launch-stuck') {
		flagRecoveryError(store, item, now, issue.reason);
		return;
	}
	const recovery =
		issue.recover && item && launch
			? await recoverTrackerSession(store, { item, launch, now })
			: null;
	publishHealthNote(store, issue, { item, recovery, now });
}

function publishHealthNote(
	store: TrackerPersistenceService,
	issue: TrackerSessionHealthIssue,
	{ item, recovery, now }: { item?: TrackerItem; recovery: string | null; now: number }
) {
	const prior = readWatchdogAlerts(store)[healthKey(issue)];
	const currentReason = prior?.identity === issue.identity ? prior.reason : issue.reason;
	const reason = recovery ? `${issue.reason} ${recovery}` : currentReason;
	recordWatchdogAlert(
		store,
		{
			...issue,
			itemId: issue.item_id,
			reason,
			key: healthKey(issue),
			localOnly: !item || issue.kind === 'finished'
		},
		now,
		null
	);
}

function healthKey(issue: TrackerSessionHealthIssue): string {
	if (issue.kind === 'orphan' || issue.kind === 'finished')
		return `${issue.item_id}:${issue.kind}:${issue.session}`;
	return `${issue.item_id}:${issue.kind}`;
}

export function trackerRecoveryLaunch(
	dispatch?: TrackerDispatcherService
): TrackerWatchdogLaunch | undefined {
	if (!dispatch) return undefined;
	return (item, attempt) =>
		dispatch.request(item.id, {
			source: 'recovery',
			token: attempt?.token ?? randomUUID(),
			expectedAuto: item.auto,
			rung: attempt?.rung
		});
}

export async function recheckTrackerRecovery(
	{
		store,
		driver,
		signal
	}: { store: TrackerPersistenceService; driver: TrackerWatchdogPort; signal: AbortSignal },
	item: TrackerItem,
	launch: TrackerWatchdogLaunch,
	now: number
): Promise<TrackerDispatchResult> {
	const repository = new TrackerItemReadRepository(store.database);
	const panes = await (driver.inventory?.(signal) ?? driver.scan(signal));
	signal.throwIfAborted();
	if (!panes) return { status: 'ignored', reason: 'tmux inventory unavailable' } as const;
	const current = repository.getStored(item.id);
	const issue = readTrackerSessionHealth(store, [current], panes, now).find(
		({ item_id }) => item_id === item.id
	);
	if (current.auto !== item.auto || issue?.kind !== 'missing' || !issue.recover)
		return { status: 'held', reason: 'item or session state changed during recovery' } as const;
	return launch(current);
}
