import { HandlerRuntimeAdapter } from '../adapters/HandlerRuntimeAdapter';
import type { ImpactReport, ImpactSide } from '../core/impactTypes';
import type { GraphNode, SourceGraph, TreeEntry, UncertainNode } from '../core/sourceTypes';
import type { ComponentManifest, ScenarioManifest } from '../core/unitTypes';
import { defaultUnitsConfig, type UnitsConfig } from '../core/unitsConfig';
import { ImpactService } from '../services/ImpactService';
import { impactKernel } from './impactKernel';

/**
 * Everything the impact analysis reads of one source tree, kept small: every tracked file with
 * its content hash, the units and what they own, the scenarios, and the dependency graph with
 * its edges as positions in the node list. Two of these compare any two commits exactly.
 */
export interface StoredSide {
	schemaVersion: 1;
	config: UnitsConfig;
	files: Array<[path: string, hash: string]>;
	units: Array<{ id: string; status: string; source: string[] }>;
	scenarios: ScenarioManifest[];
	nodes: Array<[id: string, kind: GraphNode['kind']]>;
	edges: Array<[from: number, to: number]>;
	uncertain: UncertainNode[];
}

/** What one commit changed against another, as the impact analysis computes it. */
export interface SourceImpact {
	/** The commit compared from; null when there was none. */
	base: string | null;
	/** True when a global, unclassified or unresolved change put every test in scope. */
	expanded: boolean;
	units: ImpactReport['units'];
	/** Scenarios the change reaches. */
	scenarios: string[];
	uncertain: ImpactReport['uncertain'];
	changed: ImpactReport['changed'];
}

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

function graphOf(stored: StoredSide): SourceGraph {
	const nodes = stored.nodes.map(([id, kind]) => ({ id, kind }));
	const edges = stored.edges.map(([from, to]) => ({
		from: nodes[from].id,
		to: nodes[to].id,
		via: ''
	}));
	return { nodes, edges, uncertain: stored.uncertain };
}

/** The side as the analysis expects it; a missing side is the state before the first commit. */
function sideOf(stored: StoredSide | null, revision: string): ImpactSide {
	const empty = { nodes: [], edges: [], uncertain: [] };
	const units = (stored?.units ?? []).map((unit) => ({
		id: unit.id,
		status: unit.status,
		owns: { source: unit.source, symbols: [] }
	}));
	return {
		revision,
		config: stored?.config ?? defaultUnitsConfig,
		entries: (stored?.files ?? []).map(([path, hash]): TreeEntry => ({ path, hash })),
		manifests: units as unknown as ComponentManifest[],
		scenarios: stored?.scenarios ?? [],
		graph: stored ? graphOf(stored) : empty
	};
}

export function impactView(report: ImpactReport, base: string | null): SourceImpact {
	return {
		base,
		expanded: report.expanded,
		units: report.units,
		scenarios: report.scenarios.affected,
		uncertain: report.uncertain,
		changed: report.changed
	};
}

/**
 * What differs between two stored sides: the same analysis the impact command runs on the two
 * commits, on what was stored of them when the history was indexed. It needs no repository,
 * so it runs wherever the history is shown, for any two revisions and in either direction.
 */
export async function sideImpact(
	base: { commit: string; side: StoredSide } | null,
	head: { commit: string; side: StoredSide }
): Promise<SourceImpact> {
	const analysis = new ImpactService(new HandlerRuntimeAdapter(impactKernel));
	const from = sideOf(base?.side ?? null, base?.commit ?? 'none');
	const report = await analysis.compute(from, sideOf(head.side, head.commit));
	return impactView(report, base?.commit ?? null);
}
