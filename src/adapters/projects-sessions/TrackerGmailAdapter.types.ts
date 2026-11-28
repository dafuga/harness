// @harness-uid u_mpr47pwba7
export interface TrackerGmailAdapterConfig {
	/** Bare mailbox address pinned to the live Google profile. */
	account: string;
	/** Private host capability returning a short-lived gmail.readonly access token. */
	readAccessToken: (signal: AbortSignal) => Promise<string>;
}
