// @harness-uid u_vv3mkblggu
export interface TrackerHealthCheck {
	name: string;
	ok: boolean;
	/** Information is reported but never alerts. */
	severity: 'fail' | 'info';
	detail: string;
}

export interface TrackerHealthReport {
	at: string;
	node: string;
	ok: boolean;
	failing: TrackerHealthCheck[];
	checks: TrackerHealthCheck[];
	/** Why an alert could not be delivered, without any URL or key. */
	alertProblems: string[];
}

export interface TrackerHealthProcess {
	pid: number;
	ageMinutes: number;
	command: string;
}

export interface TrackerHealthHost {
	freeDiskBytes(path: string): number;
	/** Null where the platform has no trustworthy available-memory figure. */
	availableMemoryMb(): number | null;
	load15(): number;
	cores: number;
	processes(): TrackerHealthProcess[];
}

export interface TrackerHealthOptions {
	host?: TrackerHealthHost;
	now?: () => number;
	/** How long an alerting run waits before it believes the API is down. */
	apiRetryMs?: number;
	post?: (url: string, init: RequestInit) => Promise<Response>;
}

export interface TrackerHealthStatus {
	pid?: number;
	sync?: {
		hub?: string;
		peers_last_seen?: Record<string, string>;
		connected?: boolean;
		lastPullOk?: string | null;
		pending_push?: number;
		disabled?: boolean;
	};
	webhook?: {
		sender?: boolean;
		configured?: boolean;
		outbox?: Record<string, number>;
		stuck?: number;
		paused?: unknown;
		routes?: { name: string; ready: boolean }[];
	};
	backup?: {
		enabled?: boolean;
		stale?: boolean;
		last_error?: string | null;
		file_error?: string | null;
	};
}
