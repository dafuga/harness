// @harness-uid u_tsdk4l7xok
import { z } from 'zod';
import type { XDigestOutbox } from '../../../core/agents-providers/xDigest.types';

const schema = z.union([
	z.strictObject({
		version: z.literal(1),
		day: z.string(),
		messages: z.array(z.string().min(1).max(4000)).min(1).max(12)
	}),
	z.strictObject({
		version: z.literal(1),
		day: z.string(),
		blocked: z.enum(['signed-out', 'site-check'])
	})
]);

/** The fetched file is untrusted: it must be this day's, bounded, and carries no destination. */
export function parseXDigestOutbox(text: string, day: string): XDigestOutbox | undefined {
	try {
		const parsed = schema.safeParse(JSON.parse(text));
		return parsed.success && parsed.data.day === day ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}
