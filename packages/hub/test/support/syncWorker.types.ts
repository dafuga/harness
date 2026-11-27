export interface TestEnv {
	DB: D1Database;
	CACHE: R2Bucket;
	ACCOUNT_SYNC: DurableObjectNamespace;
}
