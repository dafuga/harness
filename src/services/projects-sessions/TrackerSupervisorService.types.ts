// @harness-uid u_46eur7qage
export type TrackerSupervisorWorker =
	| 'adapter'
	| 'backup'
	| 'dispatch'
	| 'ignore-expiry'
	| 'messages'
	| 'notifications'
	| 'recurring'
	| 'telemetry'
	| 'watchdog'
	| 'web_push';

export interface TrackerSupervisorOptions {
	now?: () => number;
	intervalMs?: number;
	ticks?: Partial<Record<TrackerSupervisorWorker, (signal: AbortSignal) => Promise<void>>>;
	onError?(worker: TrackerSupervisorWorker, error: unknown): void;
	views?: () => Partial<TrackerSupervisorViews>;
}

export interface TrackerSupervisorViews {
	chief_of_staff: 'configured' | 'not configured';
	backup: unknown;
	machines: readonly unknown[];
	webhook: unknown;
	jobs: unknown;
	adapters: { runner: string | null; active: boolean };
	autolaunch: { enabled: boolean; active_runs: number; computers: unknown; stuck: unknown };
	quiet_hours: unknown;
	sync: Record<string, unknown>;
}
