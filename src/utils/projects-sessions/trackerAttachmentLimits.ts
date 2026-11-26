/**
 * Size limits of ask attachments. A document is synced between Tracker computers inside one
 * operation and sent in one request, so all of one ask's documents stay under the 1 MB body cap.
 */
export const trackerAttachmentLimits = {
	count: 4,
	markdownBytes: 200_000,
	/** One image as a data address (about 150 KB of image). */
	imageChars: 200_000,
	documentBytes: 400_000,
	askBytes: 700_000
} as const;
