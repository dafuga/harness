// @harness-uid u_rw64iex44n
import type { z } from 'zod';
import type { trackerGuestRequestSchema } from './dockerTrackerGuestProtocol';

export type TrackerGuestRequest = z.infer<typeof trackerGuestRequestSchema>;

export interface TrackerGuestIdentity {
	node: string;
	itemId: string;
	runId: number;
	attemptKey: string;
}

export type TrackerGuestSigningKey = (identity: Omit<TrackerGuestIdentity, 'node'>) => Buffer;

export interface TrackerGuestGrant {
	itemId: string;
	runId: number;
	apiPort: number;
	key: Uint8Array;
}
