/** The notes commit and the evidence commit of one read; null where there is no such ref. */
export interface PinnedRevisions {
	notesRevision: string | null;
	evidenceRevision: string | null;
}

export interface CurrentRefs extends PinnedRevisions {
	/** Changes whenever a note, the evidence or an archived source of the repository does. */
	digest: string;
}
