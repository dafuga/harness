export interface ModuleTaskToolBrokerScope {
	root: string;
	files: string[];
	snapshot: string;
	binDirectory: string;
	scratch: string;
}

export interface ModuleTaskToolBrokerAdapterConfig {
	name?: string;
	/** Trusted host test seam; never supplied by an agent tool request. */
	invokeCli?: (argv: string[]) => Promise<unknown>;
}

export interface BrokerFileWrite {
	path: string;
	expectedSha256: string;
	text: string;
}
