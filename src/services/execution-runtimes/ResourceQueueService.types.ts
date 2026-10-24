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
