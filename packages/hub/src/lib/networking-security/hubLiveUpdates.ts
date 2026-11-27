// @harness-uid u_the62brjqn
import { followDoorbell } from '$reports/lib/projects-sessions/realtime/followDoorbell';
import type {
	DoorbellSocket,
	RealtimeState
} from '$reports/lib/projects-sessions/realtime/realtime.types';
import { randomBytes, toBase64Url } from '../../../../remote/src/index';

/** A connected socket can stay quiet, so Home still needs a full read on its next poll. */
export const liveReadMs = 20_000;

const protocol = 'harness.sync.v1';
const deviceKey = 'harness.sync.device';

/** This browser's opaque sync id. A browser that refuses storage gets one per visit. */
function deviceId(): string {
	const fresh = toBase64Url(randomBytes(16));
	try {
		const stored = localStorage.getItem(deviceKey);
		if (stored && /^[A-Za-z0-9_-]{22}$/.test(stored)) return stored;
		localStorage.setItem(deviceKey, fresh);
	} catch {
		return fresh;
	}
	return fresh;
}

/** A browser cannot set headers on a WebSocket, so the device id travels as a subprotocol. */
function openSocket(): DoorbellSocket {
	const url = new URL('/api/sync/v1/live', location.href);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	const offered = [protocol, `harness.sync.device.${deviceId()}`];
	return new WebSocket(url, offered) as unknown as DoorbellSocket;
}

/** Follows the account's change notices. Returns the function that closes the socket. */
export function followHubUpdates(listener: {
	changed: () => void;
	state: (state: RealtimeState) => void;
}): () => void {
	const doorbell = followDoorbell({
		open: openSocket,
		onChange: (topic) => {
			if (topic === 'home' || topic === 'resync') listener.changed();
		},
		onState: listener.state
	});
	const wake = () => {
		if (document.visibilityState === 'visible') doorbell.retryNow();
	};
	window.addEventListener('online', wake);
	document.addEventListener('visibilitychange', wake);
	return () => {
		window.removeEventListener('online', wake);
		document.removeEventListener('visibilitychange', wake);
		doorbell.stop();
	};
}
