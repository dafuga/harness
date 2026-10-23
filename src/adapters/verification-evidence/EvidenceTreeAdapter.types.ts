export interface TreeFile {
	/** Path inside the tree. */
	path: string;
	/** Content, a file on disk whose bytes are stored unchanged, or a blob Git already has. */
	content: { bytes: Buffer | string } | { file: string } | { blob: string };
}

export interface TreeCommit {
	/** First parent supplies the starting tree; further parents record a merge. */
	parents: string[];
	files: TreeFile[];
	message: string;
}
