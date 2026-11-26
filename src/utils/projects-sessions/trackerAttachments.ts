import { z } from 'zod';
import { trackerAttachmentLimits } from './trackerAttachmentLimits';
import type { TrackerAttachment } from './trackerAttachment.types';

const line = (max: number) => z.string().trim().min(1).max(max);

/** The fields a caller names; the id and size are always computed by the Tracker. */
export const trackerAttachmentListing = z.object({
	kind: z.enum(['spec', 'doc', 'design']),
	title: line(160),
	repo: z
		.string()
		.max(140)
		.regex(/^[\w.-]+\/[\w.-]+$/)
		.optional(),
	pr: z.number().int().positive().max(10_000_000).optional(),
	path: line(300).optional(),
	ref: z
		.string()
		.regex(/^[0-9a-f]{7,64}$/)
		.optional(),
	url: z
		.string()
		.max(400)
		.regex(/^https:\/\/[^\s"'<>]+$/)
		.optional()
});

export const trackerAttachmentSchema = trackerAttachmentListing.extend({
	id: z.string().regex(/^[0-9a-f]{64}$/),
	bytes: z.number().int().min(0).max(trackerAttachmentLimits.documentBytes)
});

/** Read stored or received listings. Anything unreadable means there are none. */
export function trackerAttachments(stored: unknown): TrackerAttachment[] {
	const value = typeof stored === 'string' ? readJson(stored) : stored;
	const parsed = z
		.array(trackerAttachmentSchema)
		.max(trackerAttachmentLimits.count)
		.safeParse(value);
	return parsed.success ? parsed.data : [];
}

/** @pure The listing as an optional field, absent when there is none. */
export function trackerAttachmentFields(stored: unknown): { attachments?: TrackerAttachment[] } {
	const attachments = trackerAttachments(stored);
	return attachments.length ? { attachments } : {};
}

function readJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
