export interface ComponentVersion {
	unit: string;
	/** sha256 of the canonical manifest. */
	manifest: string;
	/** sha256 over the owned source paths and their git blob hashes. */
	source: string;
	/** sha256 of the canonical contract. */
	contract: string;
	/** sha256 of the canonical runtime: default and every execution target. */
	runtime: string;
	files: Array<{ path: string; hash: string }>;
}
