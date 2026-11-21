// @harness-uid u_q5pl6yqth7
export interface TrackerSyncRequest {
	/** The HTTP method as it appears on the wire. */
	method: string;
	/** The path and original query, including parameter order and percent escapes. */
	pathAndQuery: string;
	/** The serialized UTF-8 body, or the empty string for a bodyless request. */
	body?: string;
}
