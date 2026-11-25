// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import { trackerRunSchema } from '../../../repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { WatchdogIdleService } from '../WatchdogIdleService';
import { WatchdogStartupService } from '../WatchdogStartupService';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { automaticQuietHour } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { watchLaunchRequests } from './trackerWatchLaunchRequests';
import { trackerBlockerTick } from './trackerBlockerTick';
import { sendWatchdogAlerts } from './trackerHostCos';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import {
	activeWatchdogItem,
	readWatchdogAlerts,
	watchdogSnapshot
} from './trackerHostWatchdogState';
import { readTrackerSessionHealth, trackerRecoveryLaunch } from './trackerSessionHealthRuntime';
import { trackerTranscriptScan } from './trackerTranscriptScan';
import { trackerWatchdogPort } from './trackerWatchdogPort';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import { watchHostSessions } from './trackerWatchHostSessions';
import type { WatchdogSessionScan } from './trackerWatchHostSessions.types';

const minute = 60_000;

export function trackerHostWatchdog(
	store: TrackerPersistenceService,
	config: NonNullable<TrackerHostEffects['watchdog']>,
	options: Pick<WatchdogSessionScan, 'now' | 'launch' | 'idleWork' | 'automaticEnabled'>
) {
	const { now, launch, idleWork, automaticEnabled } = options;
	const driver = trackerWatchdogPort(config, store.node);
	store.database.exec(trackerRunSchema);
	const scanTranscripts = trackerTranscriptScan(store, config.transcriptRoots ?? [], now);
	const items = new TrackerItemReadRepository(store.database);
	const chiefOfStaff = config.chiefOfStaff === true && store.node === 'daniel-primary-mbp';
	let lastCosPoll = -Infinity;
	let peerAlerts: readonly TrackerWatchdogAlert[] = [];
	const syncBlockers = trackerBlockerTick({ store, items }, { enabled: chiefOfStaff, now });
	const readItems = () => items.list({ status: 'all', limit: -1 });
	const alerts = () => [...localAlerts(store, items), ...peerAlerts];
	const pollSessions = watchHostSessions(
		{ store, items, driver },
		{
			readItems,
			now,
			launch,
			idleWork,
			automaticEnabled,
			roots: config.transcriptRoots
		}
	);
	return {
		alerts,
		chiefOfStaff,
		inspect: inspectHostWatchdog({ store, items, driver }, { readItems, now, automaticEnabled }),
		async tick(signal: AbortSignal) {
			if (config.transcriptRoots?.length) await scanTranscripts(signal);
			await pollSessions(signal);
			const launchAlert =
				chiefOfStaff &&
				watchLaunchRequests(store, now(), !watchdogLaunchHold(now(), automaticEnabled));
			syncBlockers();
			if (chiefOfStaff && (launchAlert || now() - lastCosPoll >= minute)) {
				lastCosPoll = now();
				peerAlerts = (await driver.peers?.(signal)) ?? peerAlerts;
				await sendWatchdogAlerts(
					store,
					driver,
					alerts().filter(({ kind }) => kind !== 'missing' && kind !== 'context'),
					signal
				);
			}
		}
	};
}

export function configuredHostWatchdog(
	runtime: Pick<TrackerNativeRuntimeService, 'store' | 'now' | 'dispatch' | 'role'>,
	watchdog?: TrackerHostEffects['watchdog'],
	automaticEnabled?: () => boolean
) {
	if (!watchdog) return undefined;
	const { store, now, dispatch, role } = runtime;
	const idleWork =
		role === 'hub' && dispatch ? { dispatch, minutes: watchdog.idleWorkMinutes ?? 120 } : undefined;
	return trackerHostWatchdog(store, watchdog, {
		now,
		launch: trackerRecoveryLaunch(dispatch),
		automaticEnabled,
		idleWork
	});
}

function localAlerts(store: TrackerPersistenceService, items: TrackerItemReadRepository) {
	return Object.values(readWatchdogAlerts(store)).filter(({ item_id, kind }) => {
		if (kind === 'orphan' || kind === 'finished') return true;
		const item = activeWatchdogItem(items, item_id);
		if (kind === 'recovery-failed' || kind === 'handoff-failed')
			return item?.needs_daniel && !item.resolved && item.question?.startsWith('Tracker recovery:');
		return Boolean(item);
	});
}

function inspectHostWatchdog(
	{
		store,
		items,
		driver
	}: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		driver: TrackerWatchdogPort;
	},
	{
		readItems,
		now,
		automaticEnabled
	}: { readItems: () => readonly TrackerItem[]; now: () => number; automaticEnabled?(): boolean }
) {
	return async (id: string | null, signal: AbortSignal) => {
		const panes = await driver.scan(signal);
		if (!panes) return { computer: store.node, available: false, sessions: [], recovery: [] };
		const rows = readItems();
		const snapshot = watchdogSnapshot(store, rows, panes, now());
		const automaticHold = watchdogLaunchHold(snapshot.now, automaticEnabled);
		const itemId = id ? items.resolve(id).id : undefined;
		return {
			computer: store.node,
			available: true,
			sessions: new WatchdogIdleService().plan({ ...snapshot, itemId }).actions,
			startup: new WatchdogStartupService().plan({ ...snapshot, itemId }).actions,
			recovery: readTrackerSessionHealth(store, rows, panes, snapshot.now)
				.filter((issue) => !itemId || itemId === issue.item_id)
				.map((issue) =>
					issue.recover && automaticHold
						? {
								...issue,
								recover: false,
								reason: `${issue.reason} Recovery held: ${automaticHold}.`
							}
						: issue
				)
		};
	};
}

function watchdogLaunchHold(now: number, enabled?: () => boolean): string | null {
	if (enabled?.() === false) return 'automatic launcher disabled';
	return automaticQuietHour(now) ? 'automatic launch night hold' : null;
}
