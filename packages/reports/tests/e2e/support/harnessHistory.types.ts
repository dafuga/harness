export interface SeededHistory {
	repository: string;
	refs: string;
	/** A source branch that still exists; its name has a slash and a character to encode. */
	keptBranch: string;
	commits: Record<
		| 'unbaselined'
		| 'baseline'
		| 'shout'
		| 'kept'
		| 'paired'
		| 'twin'
		| 'native'
		| 'measured'
		| 'emitting'
		| 'packed'
		| 'swapped'
		| 'repacked'
		| 'vanished'
		| 'retained'
		| 'grown'
		| 'approved'
		| 'added'
		| 'established'
		| 'removed'
		| 'reordered'
		| 'restated'
		| 'unverified'
		| 'sourceOnly'
		| 'framed'
		| 'framedBaseline'
		| 'shelled'
		| 'shellRetained',
		string
	>;
}

export interface Capture {
	kind: string;
	sha256: string;
	media: string | null;
}

export interface SeededRevision {
	records: Array<{
		id: string;
		status: string;
		failures: string[];
		scenarios: Array<{
			id: string;
			status: string;
			inherited: boolean;
			origin: { record: string; commit: string };
			states: Array<{ id: string; captures: Capture[] }>;
		}>;
	}>;
}
