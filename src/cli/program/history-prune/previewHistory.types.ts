// @harness-uid u_hprunetype
export type PruneInventoryEntry = {
	path: string;
	record?: string;
	sourceCommit?: string;
	startedAt?: string;
	bytes?: number;
	retentionMatch: boolean;
	protectionReasons: string[];
};

export type PruneInventory = {
	mode: 'report-only';
	applySupported: false;
	keepLast: number;
	olderThanDays: number;
	cutoff: string;
	headCommit?: string;
	entries: PruneInventoryEntry[];
	problems: string[];
};

export type ScannedRecord = { entry: PruneInventoryEntry; startedAt: string };

export type CacheInventory = {
	entries: PruneInventoryEntry[];
	valid: ScannedRecord[];
	problems: string[];
};

export type CacheScanContext = CacheInventory & { root: string; store: string };

export type WalkResult = { bytes?: number; files: string[]; reasons: string[] };
