// @harness-uid u_bl6xl2h4a3
import {
	formatHubDeliveredNote,
	formatHubRefusedNote,
	formatHubWaitingNote,
	hubPaneMessage
} from '../../../utils/projects-sessions/hubSessionMessages';
import type { HubThreadMessage } from '../../../utils/projects-sessions/hubSessionMessages.types';
import type { TrackerChiefChannel } from '../TrackerNotificationService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { pendingHubMessages, recordHubReceipt } from './trackerHubMessageNotes';

const retryMs = 15_000;
/** The receipt's session word: Chief of Staff is reached through a channel, not a pane. */
export const chiefChannelSession = 'chief-of-staff-channel';
export const chiefChannelMissing = 'Chief of Staff channel not configured';

interface HubChiefDelivery {
	store: TrackerPersistenceService;
	/** The hub's Chief of Staff channel; undefined when none is configured. */
	channel: () => TrackerChiefChannel | undefined;
	now?: () => number;
}

/**
 * On the hub, sends each stored Chief of Staff Hub message through Chief of Staff's notification
 * channel (the destination the digest uses), never a tmux pane. A send the channel takes marks it
 * delivered with its attempt id; a busy channel leaves it stored with the reason and retries; no
 * channel at all refuses it with that reason, so it is never silently stored.
 */
export function trackerHubChiefDelivery(input: HubChiefDelivery) {
	const { store, channel } = input;
	const now = input.now ?? Date.now;
	const tried = new Map<string, number>();
	return async () => {
		for (const { itemId, message } of pendingHubMessages(store, now())) {
			if (message.target.kind !== 'cos') continue;
			if ((tried.get(message.id) ?? -Infinity) > now() - retryMs) continue;
			const chief = channel();
			if (!chief) {
				recordHubReceipt(store, itemId, formatHubRefusedNote(message.id, chiefChannelMissing));
				continue;
			}
			tried.set(message.id, now());
			// A thrown send has an uncertain outcome; the same idempotency id makes the retry safe.
			await sendOne(store, chief, { itemId, message }).catch(() => undefined);
		}
	};
}

async function sendOne(
	store: TrackerPersistenceService,
	chief: TrackerChiefChannel,
	{ itemId, message }: { itemId: string; message: HubThreadMessage }
) {
	const text = hubPaneMessage(message.id, message.text);
	const { attempt, result } = await chief.send({ id: message.id, itemId, text });
	if (result.status === 'sent') {
		const note = formatHubDeliveredNote(message.id, chiefChannelSession, attempt);
		recordHubReceipt(store, itemId, note);
		return;
	}
	const reason = `Chief of Staff channel: ${result.error}`;
	if (!result.busy) recordHubReceipt(store, itemId, formatHubRefusedNote(message.id, reason));
	else if (message.reason !== reason)
		recordHubReceipt(store, itemId, formatHubWaitingNote(message.id, reason));
}
