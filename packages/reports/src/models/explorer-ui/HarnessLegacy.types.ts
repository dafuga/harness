export interface HarnessLegacyMedia {
	id: string;
	title: string;
	status: string;
	mediaType?: string;
	capturedAt?: string;
	viewport?: string;
	media: string | null;
	gap?: string;
}
/** A report from before Git-backed records, exactly as it was recorded. */
export interface HarnessLegacyReport {
	id: string;
	title: string;
	mode: string;
	environment: string;
	status: string;
	startedAt: string;
	revision: string | null;
	/** The commit of this repository the report names, or null with `gap`. */
	linked: string | null;
	gap?: string;
	summary: string;
	checks: Array<{ id: string; title: string; status: string }>;
	media: HarnessLegacyMedia[];
}
