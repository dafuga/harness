// @harness-uid u_wwerrde2nk
export type SecurityReviewer =
	| { kind: 'manual'; decisionsPath: string }
	| { kind: 'external'; executable: string; maximumMicrousd: number };
