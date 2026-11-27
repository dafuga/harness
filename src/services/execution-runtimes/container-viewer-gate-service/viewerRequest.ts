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
	if (!host) return undefined;
	const remote = config.remote;
	if (remote?.host === host) return admitRemoteViewer(request, authority, remote);
	if (hosts.has(host)) return { devices: config.devices, origin: `http://${authority}` };
	return undefined;
}

async function admitRemoteViewer(
	request: IncomingMessage,
	authority: string | undefined,
	remote: NonNullable<ContainerViewerGateConfig['remote']>
): Promise<ViewerAdmission | undefined> {
	const assertion = request.headers['cf-access-jwt-assertion'];
	if (authority !== remote.host || typeof assertion !== 'string') return undefined;
	const expiresAt = await remote.authorize(assertion);
	if (expiresAt === undefined || expiresAt <= Date.now()) return undefined;
	return { devices: remote.devices, origin: `https://${remote.host}`, expiresAt };
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
