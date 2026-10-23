import type { Reached, Indexed } from './kernelClosure.types';
import type {
	AffectedNode,
	ImpactInput,
	ImpactOutput,
	KernelGraph
} from '../../../core/execution-runtimes/kernelTypes';

/** Reverse transitive closure over the base and head graphs, merged into one answer. */
export function kernelClosure(input: ImpactInput): ImpactOutput {
	const seeds = input.changed.length > 0 ? [...input.changed, ...input.uncertain] : [];
	const base = reached(input.base, seeds, input.sinks);
	const head = reached(input.head, seeds, input.sinks);
	const changed = new Set(input.changed);
	const baseOnly = base.graph.ids.filter((id) => !head.graph.index.has(id));
	const affected: AffectedNode[] = [];
	for (const id of [...head.graph.ids, ...baseOnly]) {
		const node = merge(id, base, head, changed);
		if (node) affected.push(node);
	}
	const unique = [...changed];
	return {
		affected,
		uncovered: unique.filter((id) => coverage(id, base, head) === false),
		unknown: unique.filter((id) => coverage(id, base, head) === undefined)
	};
}

function seedOf(id: string, distance: number, changed: Set<string>): AffectedNode['seed'] {
	if (changed.has(id)) return 'changed';
	return distance === 0 ? 'uncertain' : null;
}

function merge(
	id: string,
	base: Reached,
	head: Reached,
	changed: Set<string>
): AffectedNode | undefined {
	const inBase = base.graph.index.get(id);
	const inHead = head.graph.index.get(id);
	const fromBase = inBase === undefined ? -1 : base.distance[inBase];
	const fromHead = inHead === undefined ? -1 : head.distance[inHead];
	const hasBase = fromBase >= 0;
	const hasHead = fromHead >= 0;
	if (!hasBase && !hasHead) return undefined;
	const both = hasBase && hasHead;
	const single = hasBase ? 'base' : 'head';
	const singleDistance = hasBase ? fromBase : fromHead;
	const distance = both ? Math.min(fromBase, fromHead) : singleDistance;
	return {
		id,
		distance,
		via: both ? 'both' : single,
		presence: presence(inBase, inHead),
		seed: seedOf(id, distance, changed)
	};
}

function presence(
	inBase: number | undefined,
	inHead: number | undefined
): AffectedNode['presence'] {
	if (inBase === undefined) return 'added';
	return inHead === undefined ? 'removed' : 'both';
}

/** Whether a sink depends on the id: judged in head when present there, otherwise in base. */
function coverage(id: string, base: Reached, head: Reached): boolean | undefined {
	const inHead = head.graph.index.get(id);
	if (inHead !== undefined) return head.covered[inHead] >= 0;
	const inBase = base.graph.index.get(id);
	return inBase === undefined ? undefined : base.covered[inBase] >= 0;
}

function reached(graph: KernelGraph, seeds: string[], sinks: string[]): Reached {
	const indexed = indexGraph(graph);
	return {
		graph: indexed,
		distance: breadthFirst(indexed, seeds, indexed.dependents),
		covered: breadthFirst(indexed, sinks, indexed.dependencies)
	};
}

function indexGraph(graph: KernelGraph): Indexed {
	const dependents: number[][] = graph.nodes.map(() => []);
	const dependencies: number[][] = graph.nodes.map(() => []);
	for (const [from, to] of graph.edges) {
		dependents[to].push(from);
		dependencies[from].push(to);
	}
	const index = new Map(graph.nodes.map((id, position) => [id, position]));
	return { ids: graph.nodes, index, dependents, dependencies };
}

function breadthFirst(graph: Indexed, starts: string[], next: number[][]): Int32Array {
	const distance = new Int32Array(graph.ids.length).fill(-1);
	const queue: number[] = [];
	for (const id of starts) {
		const position = graph.index.get(id);
		if (position === undefined || distance[position] === 0) continue;
		distance[position] = 0;
		queue.push(position);
	}
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const current = queue[cursor];
		for (const neighbor of next[current]) {
			if (distance[neighbor] !== -1) continue;
			distance[neighbor] = distance[current] + 1;
			queue.push(neighbor);
		}
	}
	return distance;
}
