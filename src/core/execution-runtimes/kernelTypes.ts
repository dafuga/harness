export const kernelContract = 'impact-kernel/1';

/** Node ids plus edges as `[dependent, dependency]` indexes into `nodes`. */
export interface KernelGraph {
	nodes: string[];
	edges: Array<[number, number]>;
}

export interface ImpactInput {
	base: KernelGraph;
	head: KernelGraph;
	/** Ids that changed, were added or were removed between the graphs. */
	changed: string[];
	/** Ids whose dependencies are not fully known; seeds whenever anything changed. */
	uncertain: string[];
	/**
	 * Tests and scenarios. A changed id is covered when a sink depends on it, judged in the head
	 * graph for an id that still exists there and in the base graph only for a removed id.
	 */
	sinks: string[];
}

export interface AffectedNode {
	id: string;
	/** Fewest dependency hops from a seed, across both graphs. */
	distance: number;
	via: 'base' | 'head' | 'both';
	presence: 'both' | 'added' | 'removed';
	seed: 'changed' | 'uncertain' | null;
}

export interface ImpactOutput {
	/** Head order first, then nodes that exist only in the base graph. */
	affected: AffectedNode[];
	/**
	 * Changed ids nothing proves any more. Deliberately conservative: an id that survives into
	 * head needs a sink in head, even if base covered it; base coverage counts only once the id
	 * is gone.
	 */
	uncovered: string[];
	/** Changed ids that exist in neither graph. */
	unknown: string[];
}
