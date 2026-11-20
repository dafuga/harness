// @harness-uid u_bupajbnjit
export interface SiblingFlags {
	project?: string;
	commit?: string;
	model: string;
	reviewLimit: number;
	report?: string;
	class?: string;
	origin?: string;
	reportOnly?: boolean;
	repair?: boolean;
	workerModel?: string;
	testCommand?: string;
}

export interface ReviewFlags {
	project?: string;
	commit?: string;
	model: string;
	reviewLimit: number;
}
