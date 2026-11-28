// @harness-uid u_f7lraphgtu
import { SessionStreamPublisherService } from './SessionStreamPublisherService';
import type { SessionStreamTarget } from './SessionStreamPublisherService.types';
import { SessionSyncTransport } from './SessionSyncTransport';

/** Call from the native run owner with the same authenticated account's enrolled scope keys. */
export function openSessionPublisher(target: SessionStreamTarget, runId: string) {
	return new SessionStreamPublisherService(target.keys, runId, new SessionSyncTransport(target));
}
