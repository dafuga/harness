/** The clear header of a sealed record: the only part of an envelope the server reads. */
export interface RecordHeader {
	scope: string;
	epoch: number;
	objectId: string;
	/** Null when the revision is past 2^53, which the server refuses. */
	revision: number | null;
	size: number;
	bytes: Uint8Array;
}
