export interface ImpactOptions {
	root?: string;
	/** Revision to compare from; defaults to `HEAD`. */
	base?: string;
	/** Revision to compare to; defaults to the working tree. */
	head?: string;
	runtime?: string;
}
