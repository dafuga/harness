// @harness-uid u_ly3hxvctan
export interface SlackHistoryAdapterConfig {
	workspaceId: string;
	/** Resolved per request and never stored, logged or included in errors. */
	token: () => Promise<string>;
	fetch?: typeof fetch;
	sleep?: (milliseconds: number) => Promise<void>;
}
