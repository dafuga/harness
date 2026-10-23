export interface NativeHostedCredential {
	origin: string;
	principalId: string;
	token: string;
}

export interface RemoteHttpOptions {
	origin: string;
	/** Main-process OS-backed session store, never renderer-supplied identity or bearer tokens. */
	credentials: () => Promise<NativeHostedCredential | null>;
	fetch?: typeof fetch;
	authorityVersion?: () => number;
	onDenied?: (principalId: string, projectId?: string) => Promise<void>;
}
