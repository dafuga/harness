// @harness-uid u_bl6xl2h4a3
export type TrackerHostEffectsMode =
	| { mode: 'held' }
	| ({ mode: 'active'; checkpoint: string } & Omit<
			TrackerHostEffects,
			'adapter' | 'workerClient'
	  > & {
				adapter?: TrackerHostAdapterConfig;
			});

export interface TrackerHostEffects {
	workerClient?: TrackerWorkerClient;
	launch?: TrackerHostLaunchConfig;
	watchdog?: ({ driver: string } | { tmux: string }) & { chiefOfStaff?: true };
	adapter?: TrackerHostAdapterConfig & { leaseFile: string };
}

export type TrackerHostLaunchConfig = {
	maxConcurrent?: number;
	legacyRunDirectory?: string;
	repositories: Record<string, TrackerHostRepository>;
	due?: true;
} & ({ driver: string } | { managed: TrackerManagedLaunchConfig });

export interface TrackerManagedLaunchConfig {
	tmux: string;
	stateDirectory: string;
	trackerBinDirectory: string;
	native?: { codex: string; claude: string; profile: string };
	docker?: { harness: string; image: string; profile: string };
}

export interface TrackerHostRepository {
	repo: string;
	platform: 'linux' | 'macos';
}

export type TrackerHostAdapterBinding =
	| { driver: string }
	| { github: { executable: string; configDirectory: string } };

export type TrackerHostAdapterConfig = TrackerHostAdapterBinding & {
	scheduleDue?: true;
	dueDisk?: { freePct: number; freeGB: number };
};

export interface TrackerWorkerClient {
	node: string;
	role: 'hub' | 'spoke';
	apiPort: number;
	syncPort?: number;
	writeGuestAuth?: TrackerGuestAuthWriter;
}

/** Injected by the node's host signer. The managed launcher owns the private per-run path. */
export type TrackerGuestAuthWriter = (scope: {
	path: string;
	itemId: string;
	runId: number;
	key: string;
	apiPort: number;
}) => void;
