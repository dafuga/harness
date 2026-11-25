// @harness-uid u_bupajbnjit
export interface SecurityRunFlags {
	project?: string;
	maxDurationMs: number;
	maxCostUsd: number;
}

export interface SecurityScanFlags extends SecurityRunFlags {
	commit: string;
	reviewLimit: number;
}

export interface SecurityReviewFlags extends SecurityRunFlags {
	decisions?: string;
	reviewer?: string;
	reviewerMaxUsd?: number;
}
