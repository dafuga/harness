// @harness-uid u_bl6xl2h4a3
export type TrackerHostEffectsMode =
	| { mode: 'held' }
	| ({ mode: 'active'; checkpoint: string } & Omit<TrackerHostEffects, 'adapter'> & {
				adapter?: TrackerHostAdapterBinding;
			});

export interface TrackerHostEffects {
	launch?: TrackerHostLaunchConfig;
	watchdog?: ({ driver: string } | { tmux: string }) & { chiefOfStaff?: true };
	adapter?: TrackerHostAdapterBinding & { leaseFile: string };
}

export interface TrackerHostLaunchConfig {
	driver: string;
	repositories: Record<string, TrackerHostRepository>;
	due?: true;
}

export interface TrackerHostRepository {
	repo: string;
	platform: 'linux' | 'macos';
}

export type TrackerHostAdapterBinding =
	| { driver: string }
	| { github: { executable: string; configDirectory: string } };
