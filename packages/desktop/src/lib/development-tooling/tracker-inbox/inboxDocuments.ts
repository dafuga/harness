// @harness-uid u_74hbk4btwd
import type {
	InboxAttachment,
	TrackerInboxSource
} from '../../../models/development-tooling/TrackerInbox.types';

/** "View spec" reads the text that came with the item, or asks the page's own source for it. */
export function inboxDocuments(source: TrackerInboxSource, itemId: string) {
	return async (attachment: InboxAttachment) =>
		attachment.content ?? (await source.document?.(itemId, attachment.id))?.value ?? null;
}
