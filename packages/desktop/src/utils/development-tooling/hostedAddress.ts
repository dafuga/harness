const loopback = ['localhost', '127.0.0.1', '[::1]'];
const approval = /^\/native\/[A-Za-z0-9_-]{1,128}$/;

/** Nothing but scheme, host and path: no user information, no query, no fragment. */
function plain(url: URL) {
	return !url.username && !url.password && !url.search && !url.hash;
}
function secure(url: URL) {
	return url.protocol === 'https:' || (url.protocol === 'http:' && loopback.includes(url.hostname));
}

/**
 * The address a person opens in their own browser to approve this device, or null when what
 * the bridge handed over is not exactly that: https (http only on this machine), plain, and
 * the approval path with one identifier.
 */
export function hostedAddress(value: string | undefined): string | null {
	try {
		const url = new URL(value ?? '');
		return secure(url) && plain(url) && approval.test(url.pathname) ? url.href : null;
	} catch {
		return null;
	}
}
