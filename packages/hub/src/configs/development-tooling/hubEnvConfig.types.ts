export interface HubEnv {
	HARNESS_GOOGLE_CLIENT_ID?: string;
	HARNESS_SESSION_SECRET?: string;
	HARNESS_PUBLIC_ORIGIN?: string;
	HARNESS_ENVIRONMENT?: 'local' | 'staging' | 'production';
	HARNESS_GITHUB_APP_ID?: string;
	HARNESS_GITHUB_PRIVATE_KEY?: string;
	HARNESS_GITHUB_CLIENT_ID?: string;
	HARNESS_GITHUB_CLIENT_SECRET?: string;
	HARNESS_COLLABORATION_OWNER?: string;
	HARNESS_COLLABORATION_REPO?: string;
	HARNESS_COLLABORATION_REPOSITORY_ID?: string;
	HARNESS_COLLABORATION_INSTALLATION_ID?: string;
	HARNESS_EMAIL_API_KEY?: string;
	HARNESS_EMAIL_FROM?: string;
	/** The relay hosts and phones connect to. With `REMOTE_HOSTS` it enables the remote host API. */
	HARNESS_RELAY_ORIGIN?: string;
	DB?: D1Database;
	CACHE?: R2Bucket;
	/** The relay's host objects, reachable through this binding only. */
	REMOTE_HOSTS?: DurableObjectNamespace;
}
