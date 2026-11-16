// @harness-uid u_wugtubbkbv
import type { ResourceSnapshot } from '../../core/execution-runtimes/resourceTypes';

export interface RunOptions {
	signal?: AbortSignal;
	env?: Record<string, string | undefined>;
	waitTimeoutMs?: number;
	onWaiting?: (reason: string) => void;
}

export interface Dependencies {
	home?: string;
	env?: Record<string, string | undefined>;
	monitor?: { sample(): Promise<ResourceSnapshot> };
}

/**
 * A resource request the queue refuses: a bad wait timeout, an unusable owner, a full queue,
 * or an invalid or over-budget inherited lease.
 */
export class ResourceQueueError extends Error {
	override name = 'ResourceQueueError';
}
