// @harness-uid u_fyf7e7kyi5
import type {
	TrackerManagedLaunchConfig,
	TrackerWorkerClient
} from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type { trackerClaudeAquaSocket } from './trackerTmuxPane';

export type TrackerManagedPresence = 'live' | 'absent' | 'unknown';

export interface TrackerManagedReceipt {
	node: string;
	itemId: string;
	runId: number;
	key: string;
	token: string;
	tmux: string;
	socket?: typeof trackerClaudeAquaSocket;
	issuedAt: number;
	checkClaudeStartup?: true;
}

export interface TrackerManagedCommand {
	home: string;
	username?: string;
	argv: string[];
	image?: string;
}

export interface TrackerNativeLaunch {
	prompt: string;
	itemId: string;
	claudeSession?: string;
	sessionName?: string;
}

export type TrackerManagedProfiles = Pick<TrackerManagedLaunchConfig, 'native' | 'docker'>;

export interface TrackerManagedTarget {
	tmux: string;
	trackerBin: string;
	trackerExecutable: string;
	worktree: string;
	/** Human-readable tmux window name. */
	windowName?: string;
}

export interface TrackerManagedExec {
	script: string;
	command: TrackerManagedCommand;
	clientPath: string;
	cpuBudget?: number;
	guestAuthFile?: string;
}

export interface TrackerManagedLauncherOptions {
	client: TrackerWorkerClient;
	platform?: typeof process.platform;
	transcriptRoots?: readonly string[];
}

export interface TrackerManagedStartBindings {
	directory: string;
	tmux: string;
	trackerBin: string;
	trackerExecutable: string;
	profiles: TrackerManagedProfiles;
	platform: typeof process.platform;
	client: TrackerWorkerClient;
}
