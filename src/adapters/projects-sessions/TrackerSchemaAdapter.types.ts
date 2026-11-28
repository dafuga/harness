// @harness-uid u_tzqekyfiyf
export interface TrackerSchemaAdapterConfig {
	now?: () => number;
	chiefReview?: 'local' | 'replicas';
	databaseId?: () => string;
}

export interface TrackerDatabaseIdentity {
	createdAt: number;
	dbId: string;
}

export interface TrackerReplayOperation {
	item_id: string;
	fields: string;
	hlc: string;
}
