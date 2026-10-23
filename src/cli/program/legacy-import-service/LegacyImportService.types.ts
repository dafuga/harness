export interface LegacyImport {
	imported: Array<{
		id: string;
		status: string;
		startedAt: string;
		revision: string | null;
		/** The commit of this repository the recorded revision resolves to, if it does. */
		linked: string | null;
		media: number;
		created: boolean;
	}>;
	skipped: Array<{ id: string; reason: string }>;
}
