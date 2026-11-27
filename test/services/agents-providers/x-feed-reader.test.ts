import { expect, test } from 'vitest';
import { XFeedReaderService } from '../../../src/services/agents-providers/XFeedReaderService';
import { classifyXUrl } from '../../../src/services/agents-providers/x-feed-reader-service/classifyXUrl';
import { parseXPosts } from '../../../src/services/agents-providers/x-feed-reader-service/parseXPosts';
import {
	readPostsScript,
	scrollScript,
	selectHomeTabScript,
	siteCheckScript
} from '../../../src/services/agents-providers/x-feed-reader-service/xPageScripts';

const row = (id: string) => ({
	id,
	author: 'someone',
	name: 'Some One',
	text: `post ${id}`,
	counts: '3 replies, 12 reposts, 1,204 likes, 9 bookmarks, 50000 views'
});

/** A scripted X tab: its address and what each read of it returns. */
function browser(options: { url: string; after?: string; check?: boolean; empty?: boolean }) {
	const log: string[] = [];
	let url = options.url;
	let feed = 'forYou';
	const feeds: Record<string, string[]> = { forYou: ['1', '2'], following: ['3'], mentions: [] };
	const page = {
		navigate: async (next: string) => {
			log.push(`navigate ${next}`);
			url = options.after ?? next;
			feed = next.endsWith('mentions') ? 'mentions' : 'forYou';
		},
		evaluate: async (script: string) => {
			log.push(`evaluate ${url}`);
			if (script === siteCheckScript) return !!options.check;
			if (script === readPostsScript) return options.empty ? [] : feeds[feed].map(row);
			if (script === selectHomeTabScript(1)) return ((feed = 'following'), 'clicked');
			if (script === selectHomeTabScript(0)) return ((feed = 'forYou'), 'clicked');
			expect(script).toBe(scrollScript);
			return undefined;
		},
		close: () => void log.push('close')
	};
	const reader = new XFeedReaderService({
		pause: async () => {},
		browser: { pages: async () => [{ id: 'T', url }], attach: async () => page }
	});
	return { reader, log };
}

test('X addresses are classified without reading a page', () => {
	expect(classifyXUrl('https://x.com/home')).toBe('feed');
	expect(classifyXUrl('https://x.com/notifications/mentions')).toBe('feed');
	expect(classifyXUrl('https://x.com/i/flow/login')).toBe('signed-out');
	expect(classifyXUrl('https://x.com/')).toBe('signed-out');
	expect(classifyXUrl('https://x.com/account/access?lang=en')).toBe('site-check');
	expect(classifyXUrl('https://x.com.evil.example/home')).toBe('elsewhere');
	expect(classifyXUrl('about:blank')).toBe('elsewhere');
});

test('a tab waiting on sign-in or verification is never attached to', async () => {
	for (const [url, status] of [
		['https://x.com/i/flow/login', 'signed-out'],
		['https://x.com/account/access', 'site-check']
	]) {
		const { reader, log } = browser({ url });
		await expect(reader.read(10)).resolves.toEqual({ status });
		expect(log).toEqual([]);
	}
});

test('a page on another site, such as a sign-in step, is left alone', async () => {
	const { reader, log } = browser({ url: 'https://accounts.google.com/signin' });
	await expect(reader.read(10)).resolves.toEqual({ status: 'signed-out' });
	expect(log).toEqual([]);
});

test('a redirect to sign-in stops before anything on that page is evaluated', async () => {
	const { reader, log } = browser({ url: 'about:blank', after: 'https://x.com/i/flow/login' });
	await expect(reader.read(10)).resolves.toEqual({ status: 'signed-out' });
	expect(log).toEqual(['navigate https://x.com/home', 'close']);
});

test('a verification widget on a feed address stops the read', async () => {
	const { reader } = browser({ url: 'about:blank', check: true });
	await expect(reader.read(10)).resolves.toEqual({ status: 'site-check' });
});

test('reads Following, For you and mentions; an empty home feed is an error', async () => {
	const { reader } = browser({ url: 'https://x.com/home' });
	const result = await reader.read(10);
	expect(result.status).toBe('ok');
	if (result.status !== 'ok') return;
	expect(result.feeds.following.map((post) => post.id)).toEqual(['3']);
	expect(result.feeds.forYou.map((post) => post.id)).toEqual(['1', '2']);
	expect(result.feeds.mentions).toEqual([]);
	await expect(browser({ url: 'about:blank', empty: true }).reader.read(10)).rejects.toThrow(
		'no readable posts'
	);
});

test('ads and malformed rows are dropped and counts are parsed', () => {
	const posts = parseXPosts([row('9'), { ...row(''), id: '' }, { ...row('8'), author: 'a b' }]);
	expect(posts).toEqual([
		{
			id: '9',
			author: 'someone',
			name: 'Some One',
			text: 'post 9',
			likes: 1204,
			reposts: 12,
			replies: 3
		}
	]);
	expect(parseXPosts('nonsense')).toEqual([]);
});

test('page scripts never touch engagement or compose controls', () => {
	const scripts = [readPostsScript, scrollScript, siteCheckScript, selectHomeTabScript(1)];
	for (const script of scripts)
		expect(script).not.toMatch(
			/data-testid="(like|retweet|reply|follow|tweetButton)|submit|fetch\(|XMLHttp|\.focus\(/iu
		);
	expect(scripts.join('').match(/\.click\(\)/gu)).toHaveLength(1);
});
