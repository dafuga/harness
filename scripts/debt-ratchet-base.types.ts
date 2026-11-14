/** Runs one read-only git command and returns its output; throws when git fails. */
export type GitRead = (args: readonly string[]) => string;

export interface RatchetBase {
	/** Commit to compare against, or null when this checkout has no usable base. */
	commit: string | null;
	/** Why this base was chosen, including every candidate that was passed over. */
	message: string;
}
