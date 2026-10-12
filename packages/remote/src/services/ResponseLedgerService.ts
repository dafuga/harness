import { RemoteFailure, remoteLimits } from '../models/Remote.types';

interface Entry {
	digest: string;
	answer: Promise<unknown>;
	settled: boolean;
	at: number;
}
export interface LedgerOptions {
	capacity?: number;
	ttlMs?: number;
	/** How many request ids are remembered as spent. Beyond it no new mutation is accepted. */
	tombstones?: number;
	now?: () => number;
}

/**
 * Remembers the answer of each mutation by request id, so a request that is sent again after a
 * lost connection is answered from here and never performed a second time. An answer may be
 * forgotten; that its id was spent never is, so such a request is refused, not repeated.
 */
export class ResponseLedgerService {
	private entries = new Map<string, Entry>();
	/** Every request id ever run here, with its digest. */
	private readonly spent = new Map<string, string>();
	constructor(private readonly options: LedgerOptions = {}) {}
	/** Runs `execute` unless this id is known; then its first answer, pending or settled, returns. */
	run(request: { id: string; digest: string }, execute: () => Promise<unknown>): Promise<unknown> {
		this.expire();
		const known = this.entries.get(request.id);
		if (known)
			return known.digest === request.digest
				? known.answer
				: Promise.reject(new RemoteFailure('request-conflict'));
		const spent = this.spent.get(request.id);
		if (spent !== undefined)
			return Promise.reject(
				new RemoteFailure(spent === request.digest ? 'request-expired' : 'request-conflict')
			);
		if (!this.room()) return Promise.reject(new RemoteFailure('too-many-requests'));
		this.spent.set(request.id, request.digest);
		const entry: Entry = {
			digest: request.digest,
			answer: Promise.resolve().then(execute),
			settled: false,
			at: this.now()
		};
		const settle = () => {
			entry.settled = true;
			entry.at = this.now();
		};
		entry.answer.then(settle, settle);
		this.entries.set(request.id, entry);
		return entry.answer;
	}
	/** Makes room by forgetting the oldest finished answer. Unfinished work is never forgotten. */
	private room(): boolean {
		if (this.spent.size >= (this.options.tombstones ?? 65536)) return false;
		if (this.entries.size < (this.options.capacity ?? remoteLimits.ledgerEntries)) return true;
		for (const [id, entry] of this.entries) {
			if (!entry.settled) continue;
			this.entries.delete(id);
			return true;
		}
		return false;
	}
	private expire(): void {
		const limit = this.now() - (this.options.ttlMs ?? remoteLimits.ledgerTtlMs);
		for (const [id, entry] of this.entries)
			if (entry.settled && entry.at < limit) this.entries.delete(id);
	}
	private now(): number {
		return this.options.now?.() ?? Date.now();
	}
}
