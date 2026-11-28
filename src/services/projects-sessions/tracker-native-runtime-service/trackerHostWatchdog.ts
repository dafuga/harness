// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import { trackerRunSchema } from '../../../repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { WatchdogIdleService } from '../WatchdogIdleService';
import { WatchdogStartupService } from '../WatchdogStartupService';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerHostSessionCap } from './trackerHostAdmission';
import { watchLaunchRequests } from './trackerWatchLaunchRequests';
import { trackerCosRound } from './trackerCosRound';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import {
	activeWatchdogItem,
	readWatchdogAlerts,
	staleDispatchAlerts,
	watchdogSnapshot
} from './trackerHostWatchdogState';
import { readTrackerSessionHealth, trackerRecoveryLaunch } from './trackerSessionHealthRuntime';
import { readTrackerSlotState, slotAlertKinds } from './trackerSlotInvariants';
import { withSlotSummary } from './trackerSlotAlerts';
import { trackerTranscriptScan } from './trackerTranscriptScan';
import { trackerCosInboxKinds, trackerCosInboxRetention } from './trackerCosInbox';
import { trackerWatchdogPort } from './trackerWatchdogPort';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import { watchHostSessions } from './trackerWatchHostSessions';
import { trackerHubMessageDelivery } from './trackerHubMessages';
import { trackerAnswerDelivery } from './trackerAnswerDelivery';
import type { WatchdogSessionScan } from './trackerWatchHostSessions.types';

const slotAlerts = new Set(['orphan', 'finished', ...slotAlertKinds]);
const recoveryFailures = new Set(['recovery-failed', 'handoff-failed']);
const sessionAlerts = new Set(['idle', 'context', 'overdue', 'startup']);

export function trackerHostWatchdog(
	store: TrackerPersistenceService,
	config: NonNullable<TrackerHostEffects['watchdog']>,
	options: Pick<
		WatchdogSessionScan,
		'now' | 'launch' | 'settle' | 'idleWork' | 'automaticEnabled' | 'slotCap' | 'dispatchAlerts'
	>
) {
	const { now, automaticEnabled } = options;
	const driver = trackerWatchdogPort(config, store.node);
	store.database.exec(trackerRunSchema);
	const scanTranscripts = trackerTranscriptScan(store, config.transcriptRoots ?? [], now);
	const items = new TrackerItemReadRepository(store.database, now);
	const chiefOfStaff = config.chiefOfStaff === true && store.node === 'daniel-primary-mbp';
	const readItems = () => items.list({ status: 'all', limit: -1 });
	let liveSessions = new Set<string>();
	const cos = trackerCosRound(store, driver, {
		now,
		local: () => [
			...localAlerts(store, items, now(), liveSessions),
			...(options.dispatchAlerts?.() ?? [])
		]
	});
	const alerts = cos.alerts;
	const pollSessions = watchHostSessions(
		{ store, items, driver },
		{ ...options, readItems, roots: config.transcriptRoots }
	);
	const deliverMessages = trackerHubMessageDelivery({ store, driver, now });
	const deliverAnswers = trackerAnswerDelivery(store, driver, now, chiefOfStaff);
	return {
		alerts,
		chiefOfStaff,
		inspect: inspectHostWatchdog({ store, items, driver }, { ...options, readItems }),
		async tick(signal: AbortSignal) {
			try {
				try {
					if (config.transcriptRoots?.length) await scanTranscripts(signal);
					liveSessions = (await pollSessions(signal)) ?? liveSessions;
				} finally {
					// A broken pane scan must not also silence the alerts or the stuck-delivery ask.
					const launchAlert =
						chiefOfStaff &&
						watchLaunchRequests(store, now(), !watchdogLaunchHold(automaticEnabled));
					if (chiefOfStaff && !signal.aborted) await cos.run(signal, launchAlert);
				}
			} finally {
				// Answer delivery checks its own pane, even if the wider watchdog scan fails.
				if (!signal.aborted) await deliverAnswers(signal);
			}
			// Last, so a pane that cannot be typed into never holds back the checks above.
			await deliverMessages(signal);
		}
	};
}

export function configuredHostWatchdog(
	runtime: Pick<
		TrackerNativeRuntimeService,
		'store' | 'now' | 'dispatch' | 'role' | 'scheduler' | 'fleetSamples'
	>,
	hostEffects?: Pick<TrackerHostEffects, 'watchdog' | 'launch'>,
	automaticEnabled?: () => boolean
) {
	const watchdog = hostEffects?.watchdog;
	if (!watchdog) return undefined;
	const { launch } = hostEffects;
	const { store, now, dispatch, role } = runtime;
	const idleWork =
		role === 'hub' && dispatch ? { dispatch, minutes: watchdog.idleWorkMinutes ?? 120 } : undefined;
	return trackerHostWatchdog(store, watchdog, {
		now,
		launch: trackerRecoveryLaunch(dispatch),
		settle: dispatch,
		automaticEnabled,
		dispatchAlerts: role === 'hub' ? () => staleDispatchAlerts(runtime) : undefined,
		idleWork,
		slotCap: launch ? trackerHostSessionCap(store.node, launch) : null
	});
}

function localAlerts(
	store: TrackerPersistenceService,
	items: TrackerItemReadRepository,
	now: number,
	liveSessions: ReadonlySet<string>
) {
	const open = Object.values(readWatchdogAlerts(store)).filter(
		(alert) => unreadMessage(alert, now) || stillApplies(items, alert, liveSessions)
	);
	return open.map((alert) => withSlotSummary(store, alert));
}

/** A monitor may target a finished or missing item; its message must still be read. */
function unreadMessage({ kind, at }: TrackerWatchdogAlert, now: number) {
	return trackerCosInboxKinds.has(kind) && now - at < trackerCosInboxRetention;
}

function stillApplies(
	items: TrackerItemReadRepository,
	{ item_id, kind, session, identity }: TrackerWatchdogAlert,
	liveSessions: ReadonlySet<string>
) {
	// A leaked pane or idle run matters whatever its item says.
	if (slotAlerts.has(kind)) return true;
	const item = activeWatchdogItem(items, item_id);
	if (sessionAlerts.has(kind))
		return item?.status === 'in_progress' && liveSessions.has(String(session));
	const rotation = exposureRotationId(kind, identity);
	if (rotation) {
		// The scanner uses the first ten hex digits of its event hash as the rotation item ID.
		return Boolean(activeWatchdogItem(items, rotation));
	}
	if (recoveryFailures.has(kind))
		return item?.status === 'blocked' && item.blocked_reason?.startsWith('Tracker recovery:');
	return Boolean(item);
}

function exposureRotationId(kind: string, identity: string) {
	if (kind.startsWith('credential exposure:') && /^[a-f0-9]{64}:\d+$/.test(identity))
		return identity.slice(0, 10);
	return undefined;
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
		automaticEnabled,
		slotCap = null
	}: {
		readItems: () => readonly TrackerItem[];
		now: () => number;
		automaticEnabled?(): boolean;
		slotCap?: number | null;
	}
) {
	return async (id: string | null, signal: AbortSignal) => {
		const panes = await driver.scan(signal);
		if (!panes) return { computer: store.node, available: false, sessions: [], recovery: [] };
		const rows = readItems();
		const snapshot = watchdogSnapshot(store, rows, panes, now());
		const automaticHold = watchdogLaunchHold(automaticEnabled);
		const itemId = id ? items.resolve(id).id : undefined;
		const slots = readTrackerSlotState(store, panes, { now: snapshot.now, cap: slotCap });
		return {
			computer: store.node,
			available: true,
			slots: { ...slots.report, violations: slots.violations },
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

function watchdogLaunchHold(enabled?: () => boolean): string | null {
	return enabled?.() === false ? 'automatic launcher disabled' : null;
}
