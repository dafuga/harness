// @harness-uid u_2pxse2ewsf
import type {
	ConfirmedWrite,
	InboxReply,
	InboxWriteReceipt
} from '../../../models/development-tooling/TrackerInbox.types';
import type { TrackerInboxItemReply } from './MacTrackerInboxService.types';
import { projectHeader, safeId, visible } from './macTrackerInboxProjection';
import { current, readReply, trackerRequest, unavailable, writeError } from './macTrackerRequest';

function isReminderTap(input: Partial<ConfirmedWrite>): input is ConfirmedWrite {
	const { id, text, armed } = input;
	return typeof id === 'string' && safeId.test(id) && typeof text === 'string' && Boolean(armed);
}

/** Done or snooze, only for a reminder still armed for the time the button showed. */
export async function macReminderWrite(
	input: Partial<ConfirmedWrite>
): Promise<InboxReply<InboxWriteReceipt>> {
	if (!isReminderTap(input)) return current({ code: 'invalidInput' });
	const { action, id, text, armed } = input;
	try {
		const { item } = await readReply<TrackerInboxItemReply>(
			await trackerRequest(`/items/${id}/inbox`)
		);
		if (!visible(item) || projectHeader(item).reminder?.at !== armed)
			return current({ code: 'staleReview' });
		const body = action === 'remind' ? { at: text } : { occurrence: armed };
		const response = await trackerRequest(`/items/${id}/${action}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...body, by: 'Daniel via Mac app' })
		});
		if (!response.ok) return current({ code: await writeError(response) });
		await response.body?.cancel();
		return current({ value: { status: 'accepted' } });
	} catch {
		return unavailable();
	}
}
