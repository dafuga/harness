// @harness-uid u_g7kdpz7bel
import { createHash } from 'node:crypto';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { recordWatchdogAlert } from '../tracker-native-runtime-service/trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from '../tracker-native-runtime-service/trackerHostWatchdogState';
import { trackerCosInboxRetention } from '../tracker-native-runtime-service/trackerCosInbox';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { readItemBody } from './trackerLocalItemMutation';
import { trackerResponse } from './trackerLocalResponse';
import type { TrackerAlertDependencies } from './trackerLocalAlert.types';

const maxMessage = 2000;
const hour = 60 * 60_000;

export function isTrackerAlert(request: Request, parts: string[]): boolean {
	const [root, , verb] = parts;
	return request.method === 'POST' && parts.length === 3 && root === 'items' && verb === 'alert';
}

export async function trackerAlertResponse(
	request: Request,
	target: string,
	dependencies: TrackerAlertDependencies
): Promise<Response> {
	const { store, items, options } = dependencies;
	const now = options.now?.() ?? Date.now();
	return trackerResponse(200, await trackerAlertItem(request, target, { store, items, now }));
}

/**
 * Put a monitor's message, or a refused flag, on its item and on the Chief of Staff channel. It never
 * asks Daniel, and a finished, unknown or ambiguous target never loses the message.
 */
async function trackerAlertItem(
	request: Request,
	target: string,
	dependencies: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		now: number;
	}
) {
	const body = await readItemBody(request);
	const text = String(body.text ?? '')
		.trim()
		.slice(0, maxMessage);
	if (!text) throw trackerItemError('alert text required');
	const refused = body.refused ? String(body.refused).slice(0, 300) : undefined;
	const { store, items, now } = dependencies;
	const itemId = knownItem(items, target);
	const kind = refused ? 'flag-refused' : 'alert';
	const message = refused ? `refused flag: ${text} (refused because: ${refused})` : text;
	const reason = itemId ? message : `to "${target.slice(0, 40)}" (no such item): ${message}`;
	pruneOldAlerts(store, now);
	recordWatchdogAlert(
		store,
		{
			itemId: itemId ?? 'unknown',
			key: `${itemId ?? 'unknown'}:${kind}:${channel(reason)}`,
			kind,
			reason,
			// An identical repeat is recorded once an hour, so a recurring outage is raised again.
			identity: `${Math.floor(now / hour)}:${reason}`,
			localOnly: store.chiefReview || !itemId
		},
		now
	);
	return { item_id: itemId ?? null, target, kind };
}

function knownItem(items: TrackerItemReadRepository, target: string): string | undefined {
	try {
		return items.resolve(target).id;
	} catch (error) {
		const status = error instanceof Error && 'status' in error ? Number(error.status) : 500;
		if (status >= 400 && status < 500) return undefined;
		throw error;
	}
}

/** Messages that differ only in their numbers share one inbox entry; other messages keep their own. */
function channel(reason: string): string {
	const shape = reason.replace(/\d+/g, '#').slice(0, 60);
	return createHash('sha256').update(shape).digest('hex').slice(0, 12);
}

function pruneOldAlerts(store: TrackerPersistenceService, now: number): void {
	const alerts = Object.entries(readWatchdogAlerts(store));
	const kept = alerts.filter(
		([, { kind, at }]) =>
			(kind !== 'alert' && kind !== 'flag-refused') || now - at < trackerCosInboxRetention
	);
	if (kept.length !== alerts.length)
		store.writeMeta({ watchdog_alerts: JSON.stringify(Object.fromEntries(kept)) });
}
