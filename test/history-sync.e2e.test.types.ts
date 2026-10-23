export interface Synced {
	remote: string;
	evidence: string;
	notes: string;
	pushed: boolean;
}

export interface Capture {
	kind: string;
	sha256: string;
	path: string;
}
