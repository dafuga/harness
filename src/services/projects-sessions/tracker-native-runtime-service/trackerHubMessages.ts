// @harness-uid u_bl6xl2h4a3
import {
	formatHubDeliveredNote,
	formatHubRefusedNote,
	hubPaneMessage
} from '../../../utils/projects-sessions/hubSessionMessages';
import type { HubThreadMessage } from '../../../utils/projects-sessions/hubSessionMessages.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';
import { pendingHubMessages, recordHubReceipt } from './trackerHubMessageNotes';

const retryMs = 15_000;

interface HubMessageDelivery {
	store: TrackerPersistenceService;
	driver: TrackerWatchdogPort;
	now?: () => number;
}

type LocalRun = { item_id: string; state: string; ended_at: number | null; tmux: string | null };

/**
 * Types each stored session message of the last day into its run's pane, from the computer that
 * runs it only. A run that has ended or belongs to another item is refused, so no message ever
 * reaches a different session. Chief of Staff messages go through its channel on the hub instead.
 */
export function trackerHubMessageDelivery(input: HubMessageDelivery) {
	const { store, driver } = input;
	const now = input.now ?? Date.now;
	const tried = new Map<string, number>();
	return async (signal: AbortSignal) => {
		for (const { itemId, message } of pendingHubMessages(store, now())) {
			if ((tried.get(message.id) ?? -Infinity) > now() - retryMs) continue;
			const session = deliverySession(store, itemId, message);
			if (!session) continue;
			if ('refused' in session) {
				recordHubReceipt(store, itemId, formatHubRefusedNote(message.id, session.refused));
				continue;
			}
			if (!driver.deliver) return;
			tried.set(message.id, now());
			const text = hubPaneMessage(message.id, message.text);
			const result = await driver.deliver({ session: session.name, message: text }, signal);
			if (result === 'delivered')
				recordHubReceipt(store, itemId, formatHubDeliveredNote(message.id, session.name));
		}
	};
}

function deliverySession(
	store: TrackerPersistenceService,
	itemId: string,
	{ target }: HubThreadMessage
): { name: string } | { refused: string } | null {
	if (target.kind === 'cos' || target.node !== store.node) return null;
	const run = store.database
		.prepare('SELECT item_id, state, ended_at, tmux FROM runs WHERE id = ?')
		.get(target.runId) as LocalRun | undefined;
	const label = `run ${target.runId} on ${target.node}`;
	if (run?.item_id !== itemId)
		return { refused: `${label} is not this item's session; it was not sent anywhere else` };
	if (run.ended_at !== null || run.state !== 'running')
		return { refused: `${label} has ended; it was not sent to any other session` };
	return run.tmux ? { name: run.tmux } : null;
}
