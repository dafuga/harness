// @harness-uid u_fgneoorzj7
import type { XUrlState } from './classifyXUrl.types';

const hosts = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);

/**
 * Where a tab stands, judged from its address alone, so a sign-in or verification page is never
 * read. Anything unrecognised on X counts as signed out.
 */
export function classifyXUrl(address: string): XUrlState {
	const url = URL.parse(address);
	if (url?.protocol !== 'https:' || !hosts.has(url.hostname)) return 'elsewhere';
	const path = url.pathname.replace(/\/+$/u, '') || '/';
	if (path === '/home' || path === '/notifications/mentions') return 'feed';
	if (/^\/account\/(access|login_challenge|login_verification)/u.test(path)) return 'site-check';
	return 'signed-out';
}
