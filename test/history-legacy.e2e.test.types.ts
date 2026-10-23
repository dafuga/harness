export interface Imported {
	imported: Array<{
		id: string;
		status: string;
		startedAt: string;
		revision: string | null;
		linked: string | null;
		media: number;
		created: boolean;
	}>;
	skipped: Array<{ id: string; reason: string }>;
}

export interface LegacyEntry {
	id: string;
	status: string;
	startedAt: string;
	updatedAt: string;
	revision: string | null;
	linked: string | null;
	gap?: string;
	media: Array<{
		file: string;
		provenance: string;
		media: string | null;
		sha256: string;
		capturedAt?: string;
	}>;
}
