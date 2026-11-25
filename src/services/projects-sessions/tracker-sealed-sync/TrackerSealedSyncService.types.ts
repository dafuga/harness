// @harness-uid u_grqcubeu7b
import type { ScopeKeys } from '../../../../packages/remote/src/models/networking-security/Sealed.types';
import type { TrackerOperation } from '../../../repositories/projects-sessions/TrackerOperationRepository.types';

export interface OutboxEntry {
	localSeq: number;
	envelope: string;
}

export interface SyncPage {
	ops: { seq: number; opId: string; envelope: string }[];
	next: number;
	more: boolean;
}

export interface TrackerSealedSyncStore {
	/** Atomically persist an envelope before it may be uploaded. */
	stage(entry: OutboxEntry): void;
	pending(): readonly OutboxEntry[];
	acknowledge(entries: readonly OutboxEntry[]): void;
	cursor(): number;
	/** Compare the current cursor and commit the operations and replacement cursor together. */
	apply(after: number, next: number, operations: readonly TrackerOperation[]): void;
}

export interface TrackerSealedSyncOptions {
	origin: URL;
	deviceId: string;
	/** Supplies an authenticated request without exposing session credentials to the journal. */
	request: typeof fetch;
	currentKeys: ScopeKeys;
	keysAt(epoch: number): ScopeKeys | undefined;
	store: TrackerSealedSyncStore;
	/** Admission for a decrypted record before it can enter the local item projection. */
	acceptOperation?(operation: TrackerOperation): boolean;
}

/** One enrolled scope, supplied by the native device enrollment boundary. */
export interface TrackerSealedNodeOptions extends Omit<
	TrackerSealedSyncOptions,
	'store' | 'acceptOperation'
> {
	/** Stable account, journal, device, endpoint and scope identity. */
	logId: string;
	belongsToScope(operation: TrackerOperation): boolean;
}
