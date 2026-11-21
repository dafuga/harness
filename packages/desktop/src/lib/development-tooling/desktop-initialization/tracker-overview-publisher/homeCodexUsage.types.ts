// @harness-uid u_aqy5hxcviw
export interface CodexUsageWindow {
	usedPercent: number;
	windowDurationMins: number | null;
	resetsAt: number | null;
}

export interface CodexUsage {
	rateLimits?: {
		primary: CodexUsageWindow | null;
		secondary: CodexUsageWindow | null;
		credits: { hasCredits: boolean; unlimited: boolean; balance: string | null } | null;
	};
}

export interface CodexAccount {
	account: { type: string; email?: string; planType?: string; workspaceName?: string } | null;
	userId?: string;
}
