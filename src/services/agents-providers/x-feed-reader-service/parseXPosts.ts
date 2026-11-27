// @harness-uid u_eywzkjmlef
import { z } from 'zod';
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';
import type { XPost } from '../../../core/agents-providers/xDigest.types';

const raw = z.array(
	z.object({
		id: z.string(),
		author: z.string(),
		name: z.string(),
		text: z.string(),
		counts: z.string()
	})
);

/** Page content is untrusted: anything without a well-formed post address (ads) is dropped. */
export function parseXPosts(value: UntrustedValue): XPost[] {
	const parsed = raw.safeParse(value);
	if (!parsed.success) return [];
	return parsed.data
		.filter((post) => /^\d{1,25}$/u.test(post.id) && /^[A-Za-z0-9_]{1,15}$/u.test(post.author))
		.map(({ counts, ...post }) => ({
			...post,
			likes: count(counts, 'likes?'),
			reposts: count(counts, 'reposts?'),
			replies: count(counts, 'repl(?:y|ies)')
		}));
}

/** Reads one figure from X's label, such as "3 replies, 12 reposts, 1,204 likes". */
function count(label: string, noun: string): number {
	const found = new RegExp(`([\\d,]+) ${noun}\\b`, 'iu').exec(label);
	return found ? Number(found[1].replaceAll(',', '')) : 0;
}
