// @harness-uid u_fyf7e7kyi5
import type { TrackerManagedLaunchConfig } from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';

export interface TrackerManagedReceipt {
	node: string;
	itemId: string;
	runId: number;
	key: string;
	token: string;
	tmux: string;
	issuedAt: number;
}

export interface TrackerManagedCommand {
	profile: string;
	argv: string[];
	image?: string;
}

export type TrackerManagedProfiles = Pick<TrackerManagedLaunchConfig, 'native' | 'docker'>;

export interface TrackerManagedTarget {
	tmux: string;
	trackerBin: string;
	trackerExecutable: string;
	worktree: string;
}

export interface TrackerManagedExec {
	script: string;
	command: TrackerManagedCommand;
	clientPath: string;
	guestAuthFile?: string;
}
