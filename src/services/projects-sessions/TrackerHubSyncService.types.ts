import type { LandingDecision } from './tracker-hub-sync/trackerLandingQueue.types';
import type { AreaDecision } from './tracker-hub-sync/trackerAreaClaim.types';
// @harness-uid u_jkomno4o5u
import type { TrackerSyncAuthService } from '../networking-security/TrackerSyncAuthService';

import type { z } from 'zod';

export type TrackerWireValue = z.infer<ReturnType<typeof z.json>>;
export type TrackerWireObject = Readonly<Record<string, TrackerWireValue>>;

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

export type TrackerHubPayload =
	| { error: string }
	| { ok: true; applied: number; db_id: string; last: number }
	| {
			ops: readonly TrackerHubJournalEntry[];
			last: number;
			max: number;
			db_id: string;
			hub: string;
			due_policy?: unknown;
	  }
	| { ok: true; hub: string; db_id: string; max: number }
	| { allowed: boolean }
	| { ok: true; machines: readonly unknown[]; run_history?: readonly unknown[] };

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
	importRemote(node: string, runs: readonly TrackerWireValue[]): void;
	historyRowsFor(node: string): readonly unknown[];
}

export interface TrackerHubOptions {
	reviewIncomingAdds?: (ids: string[]) => void;
	landing?: (input: unknown, node: string) => LandingDecision;
	claimAreas?: (input: unknown, node: string) => AreaDecision;
	auth: TrackerSyncAuthService;
	store: TrackerHubStore;
	machines?: TrackerHubMachineStore;
	runs?: () => TrackerHubRunStore | null | undefined;
	permitAutomatic?: () => boolean;
	permitDue?: (id: string, token: string, node: string) => boolean | undefined;
	duePolicy?: () => unknown;
	now?: () => number;
}
