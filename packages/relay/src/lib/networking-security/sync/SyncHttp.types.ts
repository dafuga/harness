// @harness-uid u_7knh6lpstr
import type { SyncEnrollments } from './SyncEnrollments';
import type { SyncSockets } from './SyncSockets';

export interface SyncHttpDeps {
	sockets: SyncSockets;
	enrollments: SyncEnrollments;
	now: () => number;
	/** Arms the sweep of expired sign-in requests. */
	sweep: () => Promise<void>;
}
