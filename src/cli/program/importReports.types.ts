export interface ImportOptions {
	root?: string;
	/** Directory of the old report store; it is only read. */
	from?: string;
	/** Project id or name to import when runs were made in another directory. */
	project?: string;
}
