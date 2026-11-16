// @harness-uid u_l3f5bpp55y
export interface SnapshotDrift {
	/** Tracked files that were changed or deleted, and shared links that were replaced. */
	mutated: string[];
	/** Files the commit does not contain and no output declaration covers. */
	added: string[];
}

/** Tar exited nonzero while extracting a commit export; the message carries its stderr. */
export class TarExtractError extends Error {
	override name = 'TarExtractError';
}
