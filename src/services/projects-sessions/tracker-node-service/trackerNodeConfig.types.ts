// @harness-uid u_gvqtr5mdwv
import type { TrackerHostEffectsMode } from '../tracker-native-runtime-service/nativeTrackerHostEffects.types';

export interface TrackerNodeSessionTarget {
	cli: 'claude' | 'codex';
	session: string;
	tmux: string;
}

export type TrackerNodeTarget = { url: string; bearerFile?: string } | TrackerNodeSessionTarget;

interface TrackerNodeConfigFields {
	version: 1;
	node: string;
	database: string;
	apiPort: number;
	legacyFenceFile: string;
	legacySupervisorSocket?: string;
	syncSecretFile: string;
	backupDirectory?: string;
	hostEffects?: TrackerHostEffectsMode;
	autolaunch?: { enabled: boolean };
	notifications?: {
		targets: Record<string, TrackerNodeTarget>;
		itemCallbacks?: string[];
		chiefOfStaff?: string;
		webhook?: string;
		/** Rotating "until the next digest" ideas; an empty list turns them off. */
		suggestions?: string[];
	};
}

export interface TrackerUpstream {
	url: string;
	accessFile?: string;
}

export type TrackerNodeConfig = TrackerNodeConfigFields &
	(
		| { role: 'hub'; syncPort: number }
		| {
				role: 'spoke';
				upstream: TrackerUpstream;
				peer?: { upstream: TrackerUpstream; listenPort: number };
		  }
	);
