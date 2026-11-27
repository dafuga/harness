// @harness-uid u_pelveyu2tz
import type { XDigestConfig, XFeeds, XPost } from '../../../core/agents-providers/xDigest.types';

/**
 * Picks what is new. Mentions keep their order; the two home feeds are ranked by engagement, and a
 * post appears only once.
 */
export function selectPosts(
	feeds: XFeeds,
	seen: ReadonlySet<string>,
	limits: XDigestConfig['limits']
): XFeeds {
	const taken = new Set(seen);
	const take = (posts: XPost[], limit: number) => {
		const picked: XPost[] = [];
		for (const post of posts) {
			if (picked.length >= limit) break;
			if (taken.has(post.id)) continue;
			taken.add(post.id);
			picked.push(post);
		}
		return picked;
	};
	const ranked = (posts: XPost[]) => [...posts].sort((a, b) => score(b) - score(a));
	return {
		mentions: take(feeds.mentions, limits.mentions),
		following: take(ranked(feeds.following), limits.following),
		forYou: take(ranked(feeds.forYou), limits.forYou)
	};
}

function score(post: XPost): number {
	return post.likes + 3 * post.reposts + 2 * post.replies;
}
