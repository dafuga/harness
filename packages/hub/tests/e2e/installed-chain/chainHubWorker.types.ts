export interface ChainHubEnv {
	DB: D1Database;
	CACHE: R2Bucket;
	RELAY: { fetch(request: Request): Promise<Response> };
	REMOTE_HOSTS: DurableObjectNamespace;
	HARNESS_RELAY_ORIGIN: string;
}
