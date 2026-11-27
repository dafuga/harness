// @harness-uid u_cjwknh5i63
export interface XDigestRunInput {
	config: string;
	state?: string;
	dryRun?: boolean;
	force?: boolean;
	/** Minutes to wait while someone is using the viewer. */
	wait: number;
}
