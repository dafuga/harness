// @harness-uid u_5unsyumim2
export interface XDigestSendRunInput {
	config: string;
	state?: string;
	/** Minutes to keep checking for today's digest. */
	wait: number;
}
