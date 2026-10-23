/** What a reader can observe of an explorer screen without knowing how it is built. */
export interface Observed {
	address: string;
	heading: string;
	categories: string[];
	category: string | null;
	branch: string | null;
	commit: string | null;
	/** The accessible names of the verification marks the screen draws, each once. */
	marks: string[];
	/** Source or runner paths drawn in the content. */
	paths: string[];
}

/** What one flow asked for and what it must find, in the words of the scenario. */
export interface Flow {
	state: string;
	asked: string;
	expects: string;
	/** True where the state is the one screen that shows source on request. */
	source?: boolean;
}
