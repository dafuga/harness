export interface Index {
	legacy: Array<{
		id: string;
		status: string;
		startedAt: string;
		linked: string | null;
		media: Media[];
	}>;
	revisions: Array<{ commit: string; coverage: string }>;
}

export interface Media {
	media: string | null;
	sha256: string;
	capturedAt?: string;
}
