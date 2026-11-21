// @harness-uid u_meb6d57f7w
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
