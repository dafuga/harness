// @harness-uid u_tb2kq7wnhd
/** What the bundled Tracker service needs from the machine; tests replace it. */
export interface TrackerBundleHost {
	/** Runs a program to completion and reports its exit status and standard output. */
	run(file: string, args: string[], env?: Record<string, string>): Promise<TrackerBundleRun>;
	/** The user id whose launchd domain owns the service. */
	uid: number;
	/** Checks process existence without sending a signal. */
	isProcessRunning(pid: number): boolean;
	sleep(milliseconds: number): Promise<void>;
}

export interface TrackerBundleRun {
	status: number;
	stdout: string;
}

export interface TrackerBundleInput {
	/** The installed `Harness.app` directory. */
	app: string;
	/** The full git commit the app was built from. */
	revision: string;
	home: string;
	host: TrackerBundleHost;
	/** How many one-second readiness checks to allow after a restart. */
	readyAttempts?: number;
}

/** What an install or update did. `release` is the staged release id. */
export type TrackerBundleOutcome =
	| { status: 'not-bundled' }
	| { status: 'current'; release: string }
	| { status: 'installed'; release: string; previous: string | null; restarted: boolean }
	| { status: 'cli-only'; release: string; reason: 'no-configuration' }
	| { status: 'refused'; reason: string }
	| { status: 'rolled-back'; release: string; reason: string };

/** The record of releases this bundle staged, newest last. */
export interface TrackerBundleRecord {
	version: 1;
	releases: string[];
	current: string | null;
	revision: string | null;
}
