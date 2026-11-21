// @harness-uid u_657a3wmun2
export interface TrackerSpokeOperation {
	op_id: string;
	item_id: string;
	fields: Readonly<Record<string, unknown>>;
	hlc: string;
	node: string;
	actor?: string | null;
}

export interface TrackerSpokeJournalEntry extends TrackerSpokeOperation {
	seq: number;
}

/** Synchronous operations on the local spoke journal. Use one service per link. */
export interface TrackerSpokeStore {
	readonly node: string;
	getMeta(key: string): string | null;
	/** Persist the group atomically or throw and leave the previous values intact. */
	writeMeta(entries: Readonly<Record<string, string>>): void;
	/** Return entries in ascending local sequence order, exclusive of `since`. */
	opsSince(
		since: number,
		limit: number,
		filter?: { onlyNode: string }
	): readonly TrackerSpokeJournalEntry[];
	/** Durably apply the batch, ignoring operations already present by op_id. */
	applyOps(operations: readonly TrackerSpokeOperation[]): void;
}

export interface TrackerSpokeRequest {
	method: 'GET' | 'POST';
	pathAndQuery: string;
	body?: string;
	headers: Readonly<Record<string, string>>;
	timeoutMs: number;
}

/** Send the exact request to the configured link. Reject redirects, failed HTTP responses and timeouts. */
export type TrackerSpokeTransport = (request: TrackerSpokeRequest) => Promise<unknown>;

export interface TrackerSpokeOptions {
	store: TrackerSpokeStore;
	transport: TrackerSpokeTransport;
	secret: string | Uint8Array;
	link?: 'hub' | 'peer';
	/** Include replicated operations in normal pushes. Defaults to true for peer links. */
	relayOps?: boolean;
	pullWaitSeconds?: number;
}

export type TrackerSpokePullResult =
	| { status: 'applied'; last: number; hub: string; duePolicy?: unknown }
	| { status: 'reset' }
	| { status: 'stale' };
