// @harness-uid u_tta7f4pk5v
export type TrackerProvider = 'claude' | 'codex';

export type TrackerPreferredProvider = { provider: TrackerProvider } & (
	| { until?: never; then?: never }
	| { until: string; then?: TrackerProvider }
);
