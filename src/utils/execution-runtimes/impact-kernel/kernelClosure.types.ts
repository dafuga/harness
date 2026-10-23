export interface Indexed {
	ids: string[];
	index: Map<string, number>;
	dependents: number[][];
	dependencies: number[][];
}

export interface Reached {
	graph: Indexed;
	/** Hops from the nearest seed to each node, or -1. */
	distance: Int32Array;
	/** Non-negative for nodes some sink depends on. */
	covered: Int32Array;
}
