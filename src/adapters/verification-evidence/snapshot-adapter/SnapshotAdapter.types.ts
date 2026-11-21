// @harness-uid u_l3f5bpp55y
export interface SnapshotDrift {
	/** Tracked files that were changed or deleted, and shared links that were replaced. */
	mutated: string[];
	/** Files the commit does not contain and no output declaration covers. */
	added: string[];
}

/** A declared generated file copied out of the snapshot into a private run directory. */
export interface RetainedArtifact {
	/** Canonical relative path of the file inside the snapshot. */
	sourcePath: string;
	/** Retained copy's path relative to the run directory; always the literal `artifacts/export`. */
	path: 'artifacts/export';
	/** Raw byte count of the copied file. */
	bytes: number;
	/** SHA-256 hex digest of the bytes that were copied. */
	sha256: string;
}
