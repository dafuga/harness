import { z } from 'zod';
import { trackerAttachmentLimits as limits } from './trackerAttachmentLimits';

const imageAddress = /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export const trackerAttachmentDocumentSchema = z.object({
	markdown: z.string().min(1).max(limits.markdownBytes),
	images: z
		.record(z.string().min(1).max(400), z.string().max(limits.imageChars).regex(imageAddress))
		.optional()
});

/** UTF-8 bytes a document costs: its markdown and every inlined image. */
export function trackerAttachmentDocumentBytes(document: {
	markdown: string;
	images?: Record<string, string>;
}): number {
	const encoder = new TextEncoder();
	return Object.values(document.images ?? {}).reduce(
		(total, image) => total + image.length,
		encoder.encode(document.markdown).length
	);
}
