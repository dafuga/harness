// @harness-uid u_gst6jq4vae
import type { GithubGrantService } from '../GithubGrantService';
import type { GithubOwnerService } from '../GithubOwnerService';
import type { RequestSessionService } from '../request-session-service/RequestSessionService';

export interface GithubConnection {
	grants: GithubGrantService;
	owner: GithubOwnerService;
}

export interface GithubConnectionControllerOptions {
	origin: string;
	sessions: RequestSessionService;
	/** Null when the GitHub App is not configured. */
	github: GithubConnection | null;
}
