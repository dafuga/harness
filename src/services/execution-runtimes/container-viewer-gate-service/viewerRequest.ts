// @harness-uid u_lubgl4qne6
import type { IncomingMessage } from 'node:http';

export const viewerCookie = 'harness_viewer';

/** Only the names this viewer is published under are served, which stops DNS rebinding. */
export function allowedHost(request: IncomingMessage, hosts: ReadonlySet<string>): boolean {
	const host = request.headers.host?.toLowerCase().replace(/:\d+$/u, '');
	return host !== undefined && hosts.has(host);
}

/** A socket must come from the viewer's own page. */
export function sameOrigin(request: IncomingMessage): boolean {
	const origin = request.headers.origin;
	return origin !== undefined && URL.parse(origin)?.host === request.headers.host;
}

export function viewerToken(request: IncomingMessage): string | undefined {
	const cookies = request.headers.cookie?.split(';') ?? [];
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split('=');
		if (name === viewerCookie && /^[A-Za-z0-9_-]{43}$/u.test(value ?? '')) return value;
	}
	return undefined;
}
