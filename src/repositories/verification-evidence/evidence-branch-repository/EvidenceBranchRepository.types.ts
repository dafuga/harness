export interface StoredDirectory {
	/** The evidence commit that added the directory. */
	commit: string;
	/** False when the directory was already there with identical content. */
	created: boolean;
}
