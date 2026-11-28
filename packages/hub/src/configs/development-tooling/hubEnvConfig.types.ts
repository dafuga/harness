// @harness-uid u_w2bnm5lmqr
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
	/** The canonical Hub actor ID of the one owner allowed to read or publish the Project Overview. Unset disables it. */
	HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID?: string;
	/**
	 * The public half of the Tracker hub's application server key, from `tracker web-push setup`.
	 * Not a secret. Unset hides browser notifications and refuses the sender.
	 */
	HARNESS_PUSH_PUBLIC_KEY?: string;
	DB?: D1Database;
	CACHE?: R2Bucket;
	EVIDENCE?: R2Bucket;
	/** The relay's host objects, reachable through this binding only. */
	REMOTE_HOSTS?: DurableObjectNamespace;
	/** The relay's account sync objects: live fan-out and sign-in mailboxes of the sealed account sync. */
	ACCOUNT_SYNC?: DurableObjectNamespace;
}
