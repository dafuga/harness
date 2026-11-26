import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { trackerAttachmentLimits as limits } from './trackerAttachmentLimits';
import { trackerAttachmentListing, trackerAttachments } from './trackerAttachments';
import {
	trackerAttachmentDocumentBytes,
	trackerAttachmentDocumentSchema
} from './trackerAttachmentDocumentBytes';
import { trackerItemError } from './trackerItemError';
import type { TrackerItemValue } from './normalizeTrackerItemFields.types';
import type { TrackerAttachment, TrackerAttachmentDocument } from './trackerAttachment.types';

/** The two stored fields of an ask's attachments: the small listing and the compressed documents. */
export function storedTrackerAttachments(value: TrackerItemValue): {
	attachments: string | null;
	attachment_docs: string | null;
} {
	if (value === undefined || value === null) return { attachments: null, attachment_docs: null };
	if (!Array.isArray(value) || value.length < 1 || value.length > limits.count)
		throw trackerItemError(`attachments must be a list of 1 to ${limits.count}`);
	const entries = value.map(oneAttachment);
	const total = entries.reduce((sum, entry) => sum + entry.listing.bytes, 0);
	if (total > limits.askBytes)
		throw trackerItemError(`attachments are over ${limits.askBytes} bytes together`);
	const documents = entries.flatMap((entry) =>
		entry.packed ? [[entry.listing.id, entry.packed]] : []
	);
	return {
		attachments: JSON.stringify(entries.map((entry) => entry.listing)),
		attachment_docs: documents.length ? JSON.stringify(Object.fromEntries(documents)) : null
	};
}

function oneAttachment(raw: TrackerItemValue): { listing: TrackerAttachment; packed?: string } {
	const listing = trackerAttachmentListing.safeParse(raw);
	if (!listing.success) throw invalid(listing.error.issues[0]?.path.join('.') || 'entry');
	const source = raw as unknown as Record<string, unknown>;
	if (source.markdown === undefined) return { listing: linkOnly(listing.data) };
	const document = trackerAttachmentDocumentSchema.safeParse(source);
	if (!document.success) throw invalid(document.error.issues[0]?.path.join('.') || 'document');
	const bytes = trackerAttachmentDocumentBytes(document.data);
	if (bytes > limits.documentBytes)
		throw trackerItemError(`an attached document is over ${limits.documentBytes} bytes`);
	const text = JSON.stringify(document.data);
	return {
		listing: { ...listing.data, id: sha256(text), bytes },
		packed: gzipSync(text).toString('base64')
	};
}

/** Only a design may be a bare link; a spec or doc is always readable inside the modal. */
function linkOnly(listing: Omit<TrackerAttachment, 'id' | 'bytes'>): TrackerAttachment {
	if (listing.kind !== 'design' || !listing.url)
		throw trackerItemError(`a ${listing.kind} attachment needs its document text`);
	return { ...listing, id: sha256(listing.url), bytes: 0 };
}

/** The listed document with this id, or null when the item does not hold it intact. */
export function readTrackerAttachment(
	stored: { attachments?: unknown; attachment_docs?: string | null },
	id: string
): ({ attachment: TrackerAttachment } & TrackerAttachmentDocument) | null {
	const attachment = trackerAttachments(stored.attachments).find((entry) => entry.id === id);
	if (!attachment || !stored.attachment_docs) return null;
	try {
		const packed = (JSON.parse(stored.attachment_docs) as Record<string, string>)[id];
		if (!packed) return null;
		const text = gunzipSync(Buffer.from(packed, 'base64'), {
			maxOutputLength: limits.documentBytes * 2
		}).toString();
		if (sha256(text) !== id) return null;
		return { attachment, ...trackerAttachmentDocumentSchema.parse(JSON.parse(text)) };
	} catch {
		return null;
	}
}

function sha256(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

function invalid(field: string): Error {
	return trackerItemError(`attachment ${field} is invalid or too large`);
}
