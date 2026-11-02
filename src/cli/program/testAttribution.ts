// @harness-uid u_76b76sztpq
import type { TestAttribution, TestDependency } from './testAttribution.types';
import type { GraphEdge, SourceGraph } from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest, ScenarioManifest } from '../../core/development-tooling/unitTypes';
import { fileNode, unitNode } from '../../services/development-tooling/SourceGraphService';

/** Reports dependency facts without narrowing impact selection or claiming assertion coverage. */
export function testAttribution(
	graph: SourceGraph,
	manifest: ComponentManifest,
	scenarios: ScenarioManifest[]
): TestAttribution {
	const roots = new Set([unitNode(manifest.id), ...manifest.owns.source.map(fileNode)]);
	const incoming = new Map<string, GraphEdge[]>();
	for (const edge of graph.edges) incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
	const paths = new Map<string, GraphEdge[]>([...roots].map((root) => [root, []]));
	const queue = [...roots];
	for (let index = 0; index < queue.length; index++) {
		const node = queue[index];
		for (const edge of incoming.get(node) ?? []) {
			if (paths.has(edge.from)) continue;
			paths.set(edge.from, [edge, ...paths.get(node)!]);
			queue.push(edge.from);
		}
	}
	const tests = graph.nodes
		.filter((node) => node.kind === 'test' && /\.(?:test|spec)\.[tj]s$/.test(node.id))
		.filter((node) => paths.has(node.id))
		.map((node) => dependency(node.id, paths.get(node.id)!))
		.sort((a, b) => a.file.localeCompare(b.file));
	const direct = (test: TestDependency) =>
		test.path.length === 1 && manifest.owns.source.includes(test.path[0].to.slice(5));
	return {
		directImports: tests.filter(direct),
		transitiveImpacts: tests.filter((test) => !direct(test)),
		scenarios: scenarios
			.filter((scenario) => scenario.units.includes(manifest.id))
			.map(({ id, tests, evidence }) => ({ id, tests, evidence }))
	};
}

function dependency(node: string, path: GraphEdge[]): TestDependency {
	const references = path.filter((edge) => edge.via !== 'owns');
	let mode: TestDependency['dependency'] = 'unknown';
	if (references.length && references.every((edge) => edge.typeOnly === false)) mode = 'runtime';
	if (references.some((edge) => edge.typeOnly === true)) mode = 'type-only';
	return { file: node.slice('file:'.length), path, dependency: mode };
}
