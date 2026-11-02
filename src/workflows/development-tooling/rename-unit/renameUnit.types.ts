// @harness-uid u_mh7v3mrv6e
export interface RenameOptions {
	root?: string;
	/** The time recorded on the tombstone of the old id. */
	now?: () => string;
}

export interface RenameReport {
	from: string;
	to: string;
	/** Specification files whose references to the old id were rewritten. */
	rewritten: string[];
}
