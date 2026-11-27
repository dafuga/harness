// @harness-uid u_q5ilh2avzz
export type TrackerAgentKind = 'claude' | 'codex' | 'test-runner' | 'browser';

/** One agent session, or a test runner or browser outside any session. */
export interface TrackerProcessGroup {
	kind: TrackerAgentKind;
	pid: number;
	label: string;
	procs: number;
	/** Percent of one core. */
	cpu: number;
	rss_mb: number;
}

export interface TrackerDiskSample {
	mount: string;
	total_gb: number;
	free_gb: number;
	free_pct: number;
}

/** What one computer reports about itself. It never carries command lines. */
export interface TrackerResourceSample {
	at: string;
	platform: string;
	cores: number;
	load: number[];
	cpu_busy_pct: number | null;
	ram: {
		total_mb: number;
		used_mb: number;
		available_mb: number;
		available_pct: number;
		pressure?: 'normal' | 'warn' | 'critical';
		/** The macOS memory_pressure free percentage, when it can be read. */
		pressure_free_pct?: number;
	};
	swap: { total_mb: number; used_mb: number };
	disks: TrackerDiskSample[];
	agents: { claude: number; codex: number; test_runners: number; browsers: number };
	top_cpu: TrackerProcessGroup[];
	top_rss: TrackerProcessGroup[];
}

export type TrackerMachineState = 'ok' | 'busy' | 'overloaded' | 'offline';

export interface TrackerMachineRow {
	node: string;
	role: TrackerMachineRole;
	status: TrackerMachineState;
	reasons: string[];
	age_s: number | null;
	sample: TrackerResourceSample | null;
	remote_runs?: number;
}

export type TrackerMachineRole = 'shared' | 'runner' | 'primary' | 'other';

export type TrackerWorkKind = 'codex' | 'claude' | 'browser-tests' | 'build' | 'general';

export interface TrackerPlacementRequest {
	kind?: TrackerWorkKind;
	needsRamGB?: number;
	exclude?: readonly string[];
}

export interface TrackerPlacementCandidate {
	node: string;
	role: TrackerMachineRole;
	status: TrackerMachineState;
	fits: boolean;
	/** Null when the computer is offline and cannot be ranked. */
	score: number | null;
	reasons: string[];
}

export interface TrackerPlacement {
	kind: TrackerWorkKind;
	needs_ram_gb: number;
	recommended: string | null;
	ranked: TrackerPlacementCandidate[];
}
