import type { BuiltFile } from '../../utils/accounts-access/buildIdentity';

export interface IdentifiedBuild {
	buildId: string;
	/** Number of files the identity covers. */
	files: number;
	/** The identity written into the files, when they were stamped; it should be `buildId`. */
	stamp?: string;
}

/** One file of a build: its hash with every stamp slot emptied, and the stamps it holds. */
export type Scanned = BuiltFile & { file: string; stamps: string[]; slots: number };

export interface DeclaredBuild {
	id: string;
	directory: string;
}

export type BuiltIdentity = DeclaredBuild & IdentifiedBuild;
