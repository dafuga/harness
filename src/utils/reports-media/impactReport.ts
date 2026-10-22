import type { SourceGraph } from '../../core/development-tooling/sourceTypes';

export const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Test files in a graph: the sinks whose selection the impact report decides. */
export function graphTests(graph: SourceGraph): string[] {
	return graph.nodes
		.filter((node) => node.kind === 'test' && testFile.test(node.id))
		.map((node) => node.id.slice('file:'.length));
}

export { impactReport } from '../../services/reports-media/impact-service/impactReport';
