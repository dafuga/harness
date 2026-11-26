// @harness-uid u_bl63t752q6
import type {
	ConfirmedWrite,
	TrackerInboxSource
} from '../../../models/development-tooling/TrackerInbox.types';
import { writeFailureMessage, writeSentMessage } from './trackerInboxMessages';

/**
 * Sends the answer tapped on a Needs you row. No write means the row's read no longer admits an
 * answer; the revision it carries makes the Tracker refuse a question that was replaced since.
 */
export async function sendRowAnswer(
	source: Pick<TrackerInboxSource, 'write'>,
	write: ConfirmedWrite | null,
	mode: 'phone' | 'mac'
): Promise<{ sent: boolean; message: string }> {
	if (!write)
		return {
			sent: false,
			message: 'This ask cannot be answered from here. Open the item and review it.'
		};
	const reply = await source.write(write);
	return reply.value
		? { sent: true, message: writeSentMessage('answer', mode) }
		: { sent: false, message: writeFailureMessage(reply.code, mode) };
}
