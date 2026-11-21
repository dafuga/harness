export interface TrackerSchemaAdapterConfig {
	now?: () => number;
	databaseId?: () => string;
}

export interface TrackerDatabaseIdentity {
	createdAt: number;
	dbId: string;
}
