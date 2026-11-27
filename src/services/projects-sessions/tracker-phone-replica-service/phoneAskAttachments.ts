// @harness-uid u_ygcms2sqfs
import { trackerAttachments } from '../../../utils/projects-sessions/trackerAttachments';
import { readTrackerAttachment } from '../../../utils/projects-sessions/storedTrackerAttachments';
import { sanitizeTrackerText } from '../../../utils/projects-sessions/sanitizeTrackerText';
import type { PhoneAttachment } from './phoneAskAttachments.types';

/** What one flag's documents may add to a replica row; a page is capped at 128 KB. */
const phoneDocumentBytes = 64 * 1024;

/**
 * The phone reads documents offline, so they travel in the flag while they fit. Images are
 * dropped first; a document that still does not fit is listed and opens on GitHub instead.
 */
export function phoneAskAttachments(stored: {
	attachments?: string | null;
	attachment_docs?: string | null;
}): { attachments?: PhoneAttachment[] } {
	let room = phoneDocumentBytes;
	const attachments = trackerAttachments(stored.attachments).map((listing) => {
		const entry = { ...listing, title: sanitizeTrackerText(listing.title) };
		const found = readTrackerAttachment(stored, listing.id);
		if (!found) return entry;
		const { markdown, images } = found;
		const choices = [{ markdown, ...(images && { images }) }, { markdown }];
		const content = choices.find((choice) => size(choice) <= room);
		if (!content) return entry;
		room -= size(content);
		return { ...entry, content };
	});
	return attachments.length ? { attachments } : {};
}

function size(content: object): number {
	return Buffer.byteLength(JSON.stringify(content));
}
