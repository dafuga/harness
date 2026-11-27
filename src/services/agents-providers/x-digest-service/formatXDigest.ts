// @harness-uid u_lysvwujr5u
import type { XFeedKind, XFeeds, XPost } from '../../../core/agents-providers/xDigest.types';

const maxMessage = 3800;
const maxText = 220;
const sections: [XFeedKind, string][] = [
	['mentions', 'Mentions'],
	['following', 'Following'],
	['forYou', 'For you']
];

/** Slack messages for one day. Post text is shown as data: it cannot mention, link or format. */
export function formatXDigest(feeds: XFeeds, day: string): string[] {
	const blocks = [`*X digest · ${day}*`];
	for (const [kind, title] of sections) {
		const posts = feeds[kind];
		if (!posts.length) blocks.push(`*${title}*\nNothing new.`);
		else
			posts.forEach((post, index) =>
				blocks.push((index ? '' : `*${title}* (${posts.length} new)\n`) + line(post))
			);
	}
	const messages: string[] = [];
	for (const block of blocks) {
		const last = messages.length - 1;
		if (last >= 0 && messages[last].length + block.length + 2 <= maxMessage)
			messages[last] += `\n\n${block}`;
		else messages.push(block);
	}
	return messages;
}

function line(post: XPost): string {
	const text = clean(post.text) || '(no text)';
	const figures = `♥ ${post.likes} · ↻ ${post.reposts}`;
	const link = `<https://x.com/${post.author}/status/${post.id}|open>`;
	return `• ${clean(post.name) || post.author} (${clean(post.author)}): ${text}\n  ${figures} · ${link}`;
}

function clean(value: string): string {
	const flat = value.replace(/\s+/gu, ' ').trim();
	const short = flat.length > maxText ? `${[...flat].slice(0, maxText).join('')}…` : flat;
	return (
		short
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			// A zero-width joiner keeps copied addresses readable but never auto-linked or unfurled.
			.replaceAll('://', ':⁠//')
			.replace(/[*_~`]/gu, ' ')
	);
}
