import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { readTrackerAttachment } from '../../../utils/projects-sessions/trackerAttachmentStore';

/** `GET /items/:id/attachments/:attachmentId`: one document of an item's current ask. */
export function readTrackerAttachmentEndpoint(
	items: TrackerItemReadRepository,
	[, id, verb, attachmentId]: string[]
): { status: number; body: unknown } | undefined {
	if (verb !== 'attachments' || !attachmentId) return undefined;
	const row = items.resolve(id);
	const document = row.sensitive ? null : readTrackerAttachment(row, attachmentId);
	return document
		? { status: 200, body: document }
		: { status: 404, body: { error: 'no such attachment' } };
}
