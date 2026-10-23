export interface Entry {
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
