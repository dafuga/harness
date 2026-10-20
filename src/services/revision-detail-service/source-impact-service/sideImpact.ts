import type { StoredSide } from '../../../utils/sideImpact';
import type { ImpactSide } from '../../../core/impactTypes';

export function storedSide(side: ImpactSide): StoredSide {
	const position = new Map(side.graph.nodes.map((node, index) => [node.id, index]));
	const edges = side.graph.edges.flatMap((edge): Array<[number, number]> => {
		const [from, to] = [position.get(edge.from), position.get(edge.to)];
		return from === undefined || to === undefined ? [] : [[from, to]];
	});
	return {
		schemaVersion: 1,
		config: side.config,
		files: side.entries.map((entry) => [entry.path, entry.hash]),
		units: side.manifests.map((unit) => ({
			id: unit.id,
			status: unit.status,
			source: unit.owns.source
		})),
		scenarios: side.scenarios,
		nodes: side.graph.nodes.map((node) => [node.id, node.kind]),
		edges,
		uncertain: side.graph.uncertain
	};
}
