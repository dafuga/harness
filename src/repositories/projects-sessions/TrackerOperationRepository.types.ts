// @harness-uid u_c5mwmd6z6z
export interface TrackerOperation {
	op_id: string;
	item_id: string;
	fields: Readonly<Record<string, unknown>>;
	hlc: string;
	node: string;
	actor?: string | null;
}

export interface TrackerAppliedOperations {
	operations: TrackerOperation[];
	itemIds: string[];
}

export interface TrackerSequencedOperation extends TrackerOperation {
	seq: number;
}

export interface TrackerStoredOperation extends Omit<TrackerSequencedOperation, 'fields'> {
	fields: string;
}

export interface TrackerOperationFilter {
	onlyNode?: string;
}

export interface TrackerLocalOperation {
	node: string;
	itemId: string;
	fields: TrackerOperation['fields'];
	actor?: string | null;
}

export interface TrackerLocalCommit<T> {
	result: T;
	operation?: Omit<TrackerLocalOperation, 'node'>;
}
