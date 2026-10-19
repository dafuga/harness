import { StoredSide, SourceImpact, impactView } from '../../../../../../src/utils/sideImpact';
import { HandlerRuntimeAdapter } from '../../../../../../src/adapters/HandlerRuntimeAdapter';
import type { ImpactSide } from '../../../../../../src/core/impactTypes';
import type { SourceGraph, TreeEntry } from '../../../../../../src/core/sourceTypes';
import type { ComponentManifest } from '../../../../../../src/core/unitTypes';
import { defaultUnitsConfig } from '../../../../../../src/core/unitsConfig';
import { ImpactService } from '../../../../../../src/services/impact-service/ImpactService';
import { impactKernel } from '../../../../../../src/utils/impact-kernel/impactKernel';

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
