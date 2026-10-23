export type FileState =
	/** Nothing is there, or it already holds exactly the wanted content. */
	| { kind: 'free' }
	/** Harness wrote it and nobody changed it since, so rewriting loses nothing. */
	| { kind: 'unchanged' }
	/** The host keeps its own version on purpose. */
	| { kind: 'kept'; reason: string }
	/** Writing would lose content Harness did not put there. */
	| { kind: 'conflict'; reason: string };
