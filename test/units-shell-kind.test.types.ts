/**
 * A shell is a kind a person declares on a manifest. Reindexing keeps it and the id it has, adds
 * no second unit for the same source, and the component generator still makes components.
 */
export interface Manifest {
	id: string;
	kind: string;
	owns: { source: string[] };
}
