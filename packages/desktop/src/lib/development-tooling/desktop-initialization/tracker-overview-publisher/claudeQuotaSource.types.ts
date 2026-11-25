// @harness-uid u_k4v7d2nqwe
export interface UsageWindow {
	utilization?: number | null;
	resets_at?: string | null;
}

export interface UsageLimit {
	kind?: string;
	percent?: number | null;
	resets_at?: string | null;
	scope?: { model?: { display_name?: string | null } | null } | null;
}

/** The part of Claude's usage reply that Home shows; unknown keys are ignored. */
export interface ClaudeUsage {
	limits?: UsageLimit[] | null;
	five_hour?: UsageWindow | null;
	seven_day?: UsageWindow | null;
	seven_day_opus?: UsageWindow | null;
	seven_day_sonnet?: UsageWindow | null;
}

export interface ClaudeCredential {
	token: string;
	plan: string | null;
}

export interface ClaudeQuotaDeps {
	credential?: () => Promise<ClaudeCredential | null>;
	fetcher?: typeof fetch;
}
