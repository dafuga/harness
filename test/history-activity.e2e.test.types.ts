/**
 * The history index carries what the project did, built from Git alone, so a console installed
 * in a host shows it without Git or a database. It is a record: it holds no live state, it is
 * the same bytes whenever it is built, and it leaves the server only behind the host policy.
 */
export interface Recorded {
	kind: string;
	repository: { name: string; branch: string | null; head: string | null };
	asOf: { commit: string; committedAt: string } | null;
	loops: { total: number; types: unknown[] };
	work: Array<{
		commit: string;
		subject: string;
		units: string[];
		reasons: Array<{ unit: string; behavior: string }>;
	}>;
	files: Array<{ path: string; status: string; commit: string; units: string[] }>;
}
