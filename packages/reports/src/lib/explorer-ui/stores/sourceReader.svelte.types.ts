// @harness-uid u_dvnkqsclwa
export interface SourceState {
	files: string[];
	path: string;
	text: string;
	loading: boolean;
	error: string;
}

export type SourceFiles = () => Promise<string[]>;

export type SourceRead = (path: string) => Promise<string>;

/** An archived source entry that could not be read at this revision. */
export class ArchivedSourceReadError extends Error {
	override name = 'ArchivedSourceReadError';
}
