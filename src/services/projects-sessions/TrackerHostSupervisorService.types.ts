// @harness-uid u_yyuondcf5b
export interface TrackerHostSupervisorOptions {
	/** The command that runs the foreground Tracker service. */
	serve: string[];
	/** The command that runs one alerting health check. */
	health: string[];
	log: string;
	/** Held for the supervisor's lifetime so only one runs per database. */
	lockFile: string;
	pidFile: string;
	backoff?: { initialMs: number; maxMs: number; stableMs: number };
	maintenanceMs?: number;
	/** The next health run after an instant; the first runs shortly after start. */
	nextHealthAt?: (now: number, first: boolean) => number;
	logLimit?: number;
}
