/**
 * A large change and a busy checkout are told with bounds: a count and the first few names, a
 * flag where a list was cut, and for a working agent the moment its own allowance runs out, so
 * that a page can stop calling it working without asking again.
 */
export interface Shown {
	activity: { work: Array<{ units: string[]; unitCount: number; files: number }> };
	live: {
		worktrees: Array<{ changes: unknown[]; truncated: boolean }>;
		agents: { roster: Array<{ label: string; heartbeatAt: string; expiresAt: string }> };
	};
}
