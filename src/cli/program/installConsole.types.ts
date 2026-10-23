export interface ConsoleInstallFlags {
	host: string;
	policy: string;
	policyExport: string;
	base: string;
	data?: string;
	bucket?: string;
	prefix?: string;
	update?: boolean;
	keep?: boolean;
}

export interface ConsoleObjectEntry {
	/** Name of the object in the bucket. */
	key: string;
	/** The file of the index it is uploaded from. */
	file: string;
}
