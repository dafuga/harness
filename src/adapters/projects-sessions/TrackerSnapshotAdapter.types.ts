export interface TrackerSnapshotFingerprint {
	rowCount: number;
	sha256: string;
}

export interface TrackerSnapshotSyncOptions {
	/** Local operation author used when a link is sending only its own operations. */
	node: string;
	/** Whether the hub link normally relays operations from other nodes. Defaults to false. */
	hubRelayOps?: boolean;
	/** Whether the peer link normally relays other nodes' operations. Omit for no peer link. */
	peerRelayOps?: boolean;
}

export interface TrackerSnapshotSummary {
	schema: TrackerSnapshotFingerprint;
	tables: (TrackerSnapshotFingerprint & { name: string })[];
	pendingPush?: { hub: TrackerSnapshotFingerprint; peer?: TrackerSnapshotFingerprint };
}

export interface TrackerSnapshotComparison {
	matches: boolean;
	schemaChanged: boolean;
	changedTables: string[];
	changedPendingLinks: ('hub' | 'peer')[];
	before: TrackerSnapshotSummary;
	after: TrackerSnapshotSummary;
}
