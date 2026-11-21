// @harness-uid u_jkomno4o5u
import type { TrackerSyncAuthService } from '../networking-security/TrackerSyncAuthService';

export interface TrackerHubRequest {
	method: string;
	/** Original origin-form HTTP target, including raw query ordering and escapes. */
	pathAndQuery: string;
	headers: Headers;
	body?: ReadableStream<Uint8Array> | null;
	/** Transport cancellation, including client disconnect during a long poll. */
	signal?: AbortSignal;
}

export interface TrackerHubOperation {
	op_id: string;
	item_id: string;
	fields: Readonly<Record<string, unknown>>;
	hlc: string;
	node: string;
	actor?: string | null;
}

export interface TrackerHubJournalEntry extends TrackerHubOperation {
	seq: number;
}

export interface TrackerHubStore {
	readonly node: string;
	readonly dbId: string;
	maxSeq(): number;
	/** Return hub-sequenced entries in ascending order, exclusive of `since`. */
	opsSince(since: number, limit: number): readonly TrackerHubJournalEntry[];
	/** Apply the batch atomically, ignoring existing op_ids, and return the applied count. */
	applyOps(operations: readonly TrackerHubOperation[]): number;
	/** Notify after a committed change, including writes outside this handler. */
	subscribe(listener: () => void): () => void;
}

export interface TrackerHubMachineStore {
	record(sample: Readonly<Record<string, unknown>> & { node: string }): void;
	latestSamples(): readonly unknown[];
}

export interface TrackerHubRunStore {
	importRemote(node: string, runs: readonly unknown[]): void;
	historyRowsFor(node: string): readonly unknown[];
}

export interface TrackerHubOptions {
	auth: TrackerSyncAuthService;
	store: TrackerHubStore;
	machines?: TrackerHubMachineStore;
	runs?: () => TrackerHubRunStore | null | undefined;
	permitDue?: (id: string, token: string, node: string) => boolean | undefined;
	duePolicy?: () => unknown;
	now?: () => number;
}
