import { fail } from "../../core/errors";
import type { ImpactReport, ImpactSide } from "../../core/impactTypes";
import type { ImpactInput, ImpactOutput, KernelGraph } from "../../core/kernelTypes";
import type { RuntimeRequest, UnitRuntime } from "../../core/runtimeTypes";
import type { SourceGraph } from "../../core/sourceTypes";
import { graphTests } from "../../utils/impactReport";
import { impactReport } from "./impactReport";
import { impactSeeds } from "./impactSeeds";
import { treeChanges } from "./treeChanges";

/** Computes what a change affects by asking the impact kernel about the base and head graphs. */
export class ImpactService {
	constructor(private readonly runtime: UnitRuntime) {}

	async compute(base: ImpactSide, head: ImpactSide): Promise<ImpactReport> {
		const sides = { base, head };
		const seeds = impactSeeds(treeChanges(base.entries, head.entries), sides);
		const response = await this.runtime.invoke(this.request(sides, seeds.seeds));
		if (!response.ok) {
			return fail(`Impact kernel failed (${response.error.code}): ${response.error.message}`);
		}
		const output = response.output as ImpactOutput;
		return {
			base: base.revision,
			head: head.revision,
			runtime: this.runtime.kind,
			...impactReport({ sides, seeds, output })
		};
	}

	/** Tests and scenarios are the sinks; nodes with uncertain references are potential seeds. */
	private request(
		sides: { base: ImpactSide; head: ImpactSide },
		changed: string[]
	): RuntimeRequest {
		const graphs = [sides.base.graph, sides.head.graph];
		const sinks = graphs.flatMap((graph) => [
			...graphTests(graph).map((path) => `file:${path}`),
			...graph.nodes.filter((node) => node.kind === 'scenario').map((node) => node.id)
		]);
		const input: ImpactInput = {
			base: kernelGraph(sides.base.graph),
			head: kernelGraph(sides.head.graph),
			changed: [...new Set(changed)],
			uncertain: [
				...new Set(graphs.flatMap((graph) => graph.uncertain.map((entry) => entry.node)))
			],
			sinks: [...new Set(sinks)]
		};
		return { operation: 'impact', input };
	}
}

function kernelGraph(graph: SourceGraph): KernelGraph {
	const index = new Map(graph.nodes.map((node, position) => [node.id, position]));
	const edges: Array<[number, number]> = [];
	for (const edge of graph.edges) {
		const from = index.get(edge.from);
		const to = index.get(edge.to);
		if (from !== undefined && to !== undefined) edges.push([from, to]);
	}
	return { nodes: graph.nodes.map((node) => node.id), edges };
}
