import type { SyncCall } from './syncPolicy.types';
import { askAccount } from './syncAccount';
import { syncProblem } from './syncHttp';

const protocol = 'harness.sync.v1';
const devicePrefix = 'harness.sync.device.';

function offered(request: Request): string[] {
	const header = request.headers.get('Sec-WebSocket-Protocol') ?? '';
	return header.split(',').map((entry) => entry.trim());
}

/** A browser's device id: it cannot send `X-Harness-Device` on a WebSocket. */
export function protocolDevice(request: Request): string | null {
	const entry = offered(request).find((name) => name.startsWith(devicePrefix));
	return entry ? entry.slice(devicePrefix.length) : null;
}

/**
 * A cookie rides along on a cross-site upgrade, and an upgrade is a GET. Browsers always name
 * their origin on a WebSocket, so a named origin that is not this one is refused.
 */
export function foreignOrigin(request: Request, url: URL): boolean {
	const origin = request.headers.get('Origin');
	return origin !== null && origin !== url.origin && !request.headers.has('Authorization');
}

/** The live WebSocket: pokes, sealed stream frames and sign-in notices from the account object. */
export function live(call: SyncCall): Promise<Response> | Response {
	if (call.request.headers.get('Upgrade') !== 'websocket')
		return syncProblem(426, 'upgrade-required');
	const headers: Record<string, string> = { Upgrade: 'websocket' };
	if (offered(call.request).includes(protocol)) headers['Sec-WebSocket-Protocol'] = protocol;
	const answer = askAccount(call, `/live?device=${encodeURIComponent(call.device)}`, { headers });
	return answer ?? syncProblem(503, 'unavailable');
}
