// @harness-uid u_bl6xl2h4a3
import { hubSessionMessages } from '../../../utils/projects-sessions/hubSessionMessages';
import type { HubThreadMessage } from '../../../utils/projects-sessions/hubSessionMessages.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const day = 24 * 60 * 60_000;
const deliveryActor = 'Tracker';

/** Every Hub message of the last day that is still waiting for delivery, with its thread item. */
export function pendingHubMessages(
	store: TrackerPersistenceService,
	now: number
): { itemId: string; message: HubThreadMessage }[] {
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

/** Writes one receipt note on the message's thread item. */
export function recordHubReceipt(store: TrackerPersistenceService, itemId: string, text: string) {
	store.appendLocal({ itemId, fields: { 'note+': text }, actor: deliveryActor });
}
