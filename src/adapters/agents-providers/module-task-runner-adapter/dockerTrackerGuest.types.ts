// @harness-uid u_rw64iex44n
import type { z } from 'zod';
import type { trackerGuestRequestSchema } from './dockerTrackerGuestProtocol';

export type TrackerGuestRequest = z.infer<typeof trackerGuestRequestSchema>;

export interface TrackerGuestGrant {
	itemId: string;
	runId: number;
	apiPort: number;
	key: Uint8Array;
}
