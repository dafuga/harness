import type {
	GraphEdge,
	GraphNode,
	ResolvedReference,
	SourceGraph,
	UncertainNode
} from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest, ScenarioManifest } from '../../core/development-tooling/unitTypes';
import type { SourceIndex } from './source-index-service/SourceIndexService';

export const fileNode = (path: string): string => `file:${path}`;
export const unitNode = (id: string): string => `unit:${id}`;
export const scenarioNode = (id: string): string => `scenario:${id}`;

const crossRuntime = new Set(['process', 'http', 'wasm', 'contract']);

/** Joins source references, unit ownership and scenario contracts into one dependency graph. */
export class SourceGraphService {
	build(
		index: SourceIndex,
		manifests: ComponentManifest[],
		scenarios: ScenarioManifest[] = []
	): SourceGraph {
		const exists = (unit: ComponentManifest) =>
			unit.owns.source.some((path) => index.files.has(path));
		const active = manifests.filter((unit) => unit.status === 'active' && exists(unit));
		const owners = new Map(
			active.flatMap((unit) => unit.owns.source.map((path) => [path, unit.id]))
		);
		const files = [...index.files.values()];
		const nodes: GraphNode[] = [
			...files.map((file) => node(fileNode(file.path), file.classification, owners.get(file.path))),
			...active.map((unit) => ({ id: unitNode(unit.id), kind: 'unit' as const })),
			...scenarios.map((scenario) => ({ id: scenarioNode(scenario.id), kind: 'scenario' as const }))
		];
		const edges = [
			...files.flatMap((file) => referenceEdges(file.path, file.references)),
			...active.flatMap((unit) => unitEdges(unit, index)),
			...scenarios.flatMap((scenario) => scenarioEdges(scenario, index))
		];
		return { nodes: nodes.sort(byId), edges: unique(edges), uncertain: uncertain(index) };
	}
}

function node(id: string, kind: string, unit: string | undefined): GraphNode {
	const base = { id, kind: kind as GraphNode['kind'] };
	return unit ? { ...base, unit } : base;
}

function referenceEdges(path: string, references: ResolvedReference[]): GraphEdge[] {
	return references.flatMap((reference) =>
		reference.path
			? [{ from: fileNode(path), to: fileNode(reference.path), via: reference.via }]
			: []
	);
}

/** A unit depends on its files; its files depend on units reached across a runtime boundary. */
function unitEdges(unit: ComponentManifest, index: SourceIndex): GraphEdge[] {
	const owned = unit.owns.source.filter((path) => index.files.has(path));
	const declared = unit.dependencies.filter((dependency) => crossRuntime.has(dependency.via));
	return [
		...owned.map((path) => ({ from: unitNode(unit.id), to: fileNode(path), via: 'owns' })),
		...declared.flatMap((dependency) => [
			{ from: unitNode(unit.id), to: unitNode(dependency.unit), via: dependency.via },
			...owned.map((path) => ({
				from: fileNode(path),
				to: unitNode(dependency.unit),
				via: dependency.via
			}))
		])
	];
}

function scenarioEdges(scenario: ScenarioManifest, index: SourceIndex): GraphEdge[] {
	const from = scenarioNode(scenario.id);
	const tests = scenario.tests
		.map((test) => [test.cwd, test.target].filter(Boolean).join('/'))
		.filter((path) => index.files.has(path));
	return [
		...scenario.units.map((unit) => ({ from, to: unitNode(unit), via: 'covers' })),
		...tests.map((path) => ({ from, to: fileNode(path), via: 'proves' }))
	];
}

function uncertain(index: SourceIndex): UncertainNode[] {
	return [...index.files.values()].flatMap((file) =>
		file.references.flatMap((reference) =>
			reference.uncertain ? [{ node: fileNode(file.path), ...reference.uncertain }] : []
		)
	);
}

function unique(edges: GraphEdge[]): GraphEdge[] {
	const seen = new Map(edges.map((edge) => [`${edge.from}\n${edge.to}\n${edge.via}`, edge]));
	return [...seen.values()].sort(
		(left, right) => compare(left.from, right.from) || compare(left.to, right.to)
	);
}

function byId(left: GraphNode, right: GraphNode): number {
	return compare(left.id, right.id);
}

function compare(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}
