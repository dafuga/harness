// @harness-uid u_gvqtr5mdwv
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerHostEffectsMode } from '../tracker-native-runtime-service/nativeTrackerHostEffects.types';

export interface TrackerNodeSessionTarget {
	cli: 'claude' | 'codex';
	session: string;
	tmux: string;
}

/** A fixed local script: run with no arguments, the delivery JSON on stdin and `TRACKER_DELIVERY_ID` set. */
export interface TrackerNodeScriptTarget {
	script: string;
}

export type TrackerNodeTarget =
	| { url: string; bearerFile?: string }
	| TrackerNodeSessionTarget
	| TrackerNodeScriptTarget;

export type TrackerNodeWebhookEvent =
	| 'needs_daniel'
	| 'due'
	| 'blocked'
	| 'done'
	| 'resolved'
	| 'changed'
	| 'recurring_due'
	| 'autolaunch';

/** A bot route: webhook events for the named bots go to `target`, matched by name or alias. */
export interface TrackerNodeWebhookRoute {
	target: string;
	aliases?: string[];
}

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
	/** Model ladder, learning and Claude-only window overrides. */
	routing?: NonNullable<TrackerLadderConfig['autolaunch']>;
	notifications?: {
		targets: Record<string, TrackerNodeTarget>;
		itemCallbacks?: string[];
		/** Legacy `--callback-cmd` name to a script target id. Item text picks a name only; it never supplies arguments. */
		commandCallbacks?: Record<string, string>;
		chiefOfStaff?: string;
		webhook?: string;
		/** Bot routes for the webhook; requires `webhook`. */
		routes?: Record<string, TrackerNodeWebhookRoute>;
		/** Per-event fallback for events no route claims: `cos` or `drop`. Requires `webhook`. */
		unrouted?: Partial<Record<TrackerNodeWebhookEvent, 'cos' | 'drop'>>;
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
