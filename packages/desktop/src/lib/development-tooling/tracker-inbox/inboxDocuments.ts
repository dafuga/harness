import type { TrackerInboxSource } from '../../../models/development-tooling/TrackerInbox.types';
import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';

/** How "View spec" reads one document of an item through the page's own source. */
export function inboxDocuments(source: TrackerInboxSource, itemId: string) {
	return async (attachment: TrackerAttachment) =>
		(await source.document(itemId, attachment.id)).value ?? null;
}
