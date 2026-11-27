// @harness-uid u_lubgl4qne6
import type { IncomingMessage } from 'node:http';
import type {
	ContainerViewerGateConfig,
	ViewerAdmission
} from '../ContainerViewerGateService.types';

export function viewerCookie(secure: boolean): string {
	return secure ? '__Host-harness_viewer' : 'harness_viewer';
}

/** The public hostname always requires a verified Access assertion, including on socket upgrades. */
export async function admitViewer(
	request: IncomingMessage,
	config: ContainerViewerGateConfig,
	hosts: ReadonlySet<string>
): Promise<ViewerAdmission | undefined> {
	const authority = request.headers.host?.toLowerCase();
	const host = authority?.replace(/:\d+$/u, '');
	if (!host) return;
	const remote = config.remote;
	if (remote && host === remote.host) {
		const assertion = request.headers['cf-access-jwt-assertion'];
		if (authority !== remote.host || typeof assertion !== 'string') return;
		const expiresAt = await remote.authorize(assertion);
		if (expiresAt === undefined || expiresAt <= Date.now()) return;
		return { devices: remote.devices, origin: `https://${remote.host}`, expiresAt };
	}
	if (hosts.has(host)) return { devices: config.devices, origin: `http://${authority}` };
}

export function viewerToken(request: IncomingMessage, secure: boolean): string | undefined {
	const cookieName = viewerCookie(secure);
	const cookies = request.headers.cookie?.split(';') ?? [];
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split('=');
		if (name === cookieName && /^[A-Za-z0-9_-]{43}$/u.test(value ?? '')) return value;
	}
	return undefined;
}
