// @harness-uid u_gvqtr5mdwv
import type { TrackerHostEffectsMode } from '../tracker-native-runtime-service/nativeTrackerHostEffects.types';

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
	notifications?: {
		targets: Record<string, { url: string; bearerFile?: string }>;
		itemCallbacks?: string[];
		chiefOfStaff?: string;
		webhook?: string;
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
