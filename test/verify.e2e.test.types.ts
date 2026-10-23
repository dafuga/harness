export interface Capture {
	sha256: string;
	path: string;
	status: string;
	viewport?: string;
	transcript?: string;
	provenance?: string;
	mediaType: string;
	durationSeconds?: number;
	server?: { revision: string };
}
