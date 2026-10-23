export interface Shown {
	revision: { commit: string };
	entities: { id: string }[];
}

export interface ListedProject {
	tip: Shown;
	earlier: Shown;
	/** The detail of the analytics identity at each of the two commits. */
	details: Record<string, unknown>;
}
