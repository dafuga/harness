// @harness-uid u_bl6xl2h4a3
import {
	formatHubDeliveredNote,
	formatHubRefusedNote,
	hubPaneMessage,
	hubSessionMessages
} from '../../../utils/projects-sessions/hubSessionMessages';
import type { HubThreadMessage } from '../../../utils/projects-sessions/hubSessionMessages.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

const day = 24 * 60 * 60_000;
const retryMs = 15_000;
const deliveryActor = 'Tracker';

interface HubMessageDelivery {
	store: TrackerPersistenceService;
	driver: TrackerWatchdogPort;
	/** This computer runs the Chief of Staff pane. */
	chiefOfStaff: boolean;
	now?: () => number;
}

type LocalRun = { item_id: string; state: string; ended_at: number | null; tmux: string | null };

/**
 * Types each stored Hub message of the last day into its pane, from the computer that owns that
 * pane only: Chief of Staff's `cos` pane, or the exact run it names. A run that has ended or
 * belongs to another item is refused, so no message ever reaches a different session.
 */
export function trackerHubMessageDelivery(input: HubMessageDelivery) {
	const { store, driver, chiefOfStaff } = input;
	const now = input.now ?? Date.now;
	const tried = new Map<string, number>();
	return async (signal: AbortSignal) => {
		for (const { itemId, message } of pendingMessages(store, now())) {
			if ((tried.get(message.id) ?? -Infinity) > now() - retryMs) continue;
			const session = deliverySession(store, itemId, message, chiefOfStaff);
			if (!session) continue;
			if ('refused' in session) {
				record(store, itemId, formatHubRefusedNote(message.id, session.refused));
				continue;
			}
			if (!driver.deliver) return;
			tried.set(message.id, now());
			const text = hubPaneMessage(message.id, message.text);
			const result = await driver.deliver({ session: session.name, message: text }, signal);
			if (result === 'delivered')
				record(store, itemId, formatHubDeliveredNote(message.id, session.name));
		}
	};
}

function deliverySession(
	store: TrackerPersistenceService,
	itemId: string,
	{ target }: HubThreadMessage,
	chiefOfStaff: boolean
): { name: string } | { refused: string } | null {
	if (target.kind === 'cos') return chiefOfStaff ? { name: 'cos' } : null;
	if (target.node !== store.node) return null;
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

function pendingMessages(store: TrackerPersistenceService, now: number) {
	const since = String(now - day).padStart(15, '0');
	const rows = store.database
		.prepare(
			`SELECT item_id, hlc, text FROM item_notes
			 WHERE hlc >= ? AND (text LIKE 'Hub message %' OR text LIKE 'Reply to Hub message %')
			 ORDER BY hlc LIMIT 2000`
		)
		.all(since) as { item_id: string; hlc: string; text: string }[];
	const byItem = new Map<string, { at: string; text: string }[]>();
	for (const { item_id, hlc, text } of rows)
		byItem.set(item_id, [...(byItem.get(item_id) ?? []), { at: hlc, text }]);
	return [...byItem].flatMap(([itemId, notes]) =>
		hubSessionMessages(notes)
			.filter((message) => message.status === 'stored')
			.map((message) => ({ itemId, message }))
	);
}

function record(store: TrackerPersistenceService, itemId: string, text: string) {
	store.appendLocal({ itemId, fields: { 'note+': text }, actor: deliveryActor });
}
