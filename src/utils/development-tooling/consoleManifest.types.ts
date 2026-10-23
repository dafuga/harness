export interface ConsoleFileEntry {
	path: string;
	/** Content the file had when this record was written. */
	sha256: string;
	/** `harness` wrote it and may rewrite it; `host` keeps its own version. */
	owner: 'harness' | 'host';
}

export interface FileIdentity {
	sha256: string;
	bytes: number;
}

/** One file the installer changed although it held other content, and where that content is. */
export interface ConsoleChange {
	path: string;
	action: 'replaced' | 'removed' | 'restored';
	reason: string;
	at: string;
	/** What the file held before, and the project-local copy it can be restored from. */
	before: FileIdentity & { saved: string };
	/** What it holds now; null when the file was removed. */
	after: FileIdentity | null;
}

/** Where the installed console reads history from. */
export type ConsoleStorage =
	| { kind: 'bundle' }
	| { kind: 'bucket'; binding: string; prefix: string };

export interface ConsoleManifest {
	schemaVersion: 1;
	base?: string;
	policy?: { module: string; export: string };
	storage?: ConsoleStorage;
	files: ConsoleFileEntry[];
	/** Every replacement, removal and restore, oldest first; entries are never rewritten. */
	changes: ConsoleChange[];
}
