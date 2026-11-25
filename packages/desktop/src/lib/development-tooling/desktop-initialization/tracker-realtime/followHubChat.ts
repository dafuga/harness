import { WebSocket } from 'ws';
import { followDoorbell } from '$reports/lib/projects-sessions/realtime/followDoorbell';
import type { DoorbellSocket } from '$reports/lib/projects-sessions/realtime/realtime.types';
import { randomBytes, toBase64Url } from '../../../../../../remote/src/index';
import type { TrackerOverviewAuthority } from '../tracker-overview-publisher/TrackerOverviewPublisher.types';

/**
 * The Mac's socket to the account object. An answer or note queued on any device rings `chat`,
 * and the publisher claims it at once instead of on its next interval. The session token goes
 * only to the verified Hub origin, in a header.
 */
export function followHubChat(
	authority: TrackerOverviewAuthority,
	ownerActorId: string,
	wake: () => void
) {
	const device = toBase64Url(randomBytes(16));
	return followDoorbell({
		open: async () => {
			const credential = await authority.authorize();
			if (credential.principalId !== ownerActorId) throw new Error('Not the tracker owner');
			const url = new URL('/api/sync/v1/live', credential.origin);
			url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
			return new WebSocket(url, {
				headers: { Authorization: `Bearer ${credential.token}`, 'X-Harness-Device': device },
				followRedirects: false
			}) as unknown as DoorbellSocket;
		},
		onChange: (topic) => {
			if (topic === 'chat' || topic === 'resync') wake();
		},
		onState: () => undefined,
		maxRetryMs: 30_000
	});
}
