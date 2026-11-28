// @harness-uid u_bl6xl2h4a3
import type { TrackerEgressPolicy } from '../../../utils/projects-sessions/trackerEgressPolicy.types';
import type { TrackerGithubFollowUpPolicy } from '../TrackerAdapterPollService.types';
import type {
	TrackerHostResourceLimits,
	TrackerHostResources
} from '../../../utils/projects-sessions/trackerHostResources.types';

export type TrackerHostEffectsMode =
	| { mode: 'held' }
	| ({ mode: 'active'; checkpoint: string } & Omit<
			TrackerHostEffects,
			'adapter' | 'workerClient' | 'hostResources'
	  > & {
				adapter?: TrackerHostAdapterConfig;
			});

export interface TrackerHostEffects {
	workerClient?: TrackerWorkerClient;
	/** Replaces the live readings of this computer used by launch guards. */
	hostResources?: TrackerHostResources;
	launch?: TrackerHostLaunchConfig;
	watchdog?:
		| (({ driver: string } | { tmux: string }) & {
				chiefOfStaff?: true;
				idleWorkMinutes?: number;
				transcriptRoots?: string[];
		  })
		| { transcriptRoots: string[]; chiefOfStaff?: never; idleWorkMinutes?: never };
	adapter?: TrackerHostAdapterConfig & { leaseFile: string };
}

export type TrackerHostLaunchConfig = TrackerHostResourceLimits & {
	maxConcurrent?: number;
	/** Optional explicit non-Harbor session ceiling on MB2. */
	nonHarborSessionLimit?: number;
	legacyRunDirectory?: string;
	repositories: Record<string, TrackerHostRepository>;
	/** No Codex starts before this ISO time. */
	codexPausedUntil?: string;
	/** Due tasks launch at their time unless this is false. */
	due?: boolean;
	maxRetries?: number;
	defaultEtaMinutes?: number;
	stallMinutes?: number;
	maxRunMinutes?: number;
} & ({ driver: string } | { managed: TrackerManagedLaunchConfig });

export interface TrackerManagedLaunchConfig {
	tmux: string;
	stateDirectory: string;
	trackerBinDirectory: string;
	opsWorkdir?: string;
	native?: {
		codex: string;
		claude: string;
		profile: string;
		/** Opt-in pilot: default-deny egress for the listed Tracker items only; others keep open access. */
		egress?: { items: readonly string[]; policy: TrackerEgressPolicy };
	};
	docker?: { harness: string; image: string; profile: string };
}

export interface TrackerHostRepository {
	repo: string;
	platform: 'linux' | 'macos';
	/** Shell command that must pass after done. Managed macOS routes only. */
	verify?: string;
	/** False runs sessions in the checkout itself. Non-git directories always run in place. */
	worktree?: boolean;
}

export type TrackerHostAdapterBinding =
	| { driver: string }
	| { github: { executable: string; configDirectory: string } };

export type TrackerHostAdapterConfig = TrackerHostAdapterBinding & {
	manual?: true;
	followUp?: TrackerGithubFollowUpPolicy & {
		target: string;
		titlePrefix: string;
		issueInstructions: string;
	};
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
