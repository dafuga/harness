import type { ImpactReport } from '../core/impactTypes';
import type { GraphNode, UncertainNode } from '../core/sourceTypes';
import type { ScenarioManifest } from '../core/unitTypes';
import { type UnitsConfig } from '../core/unitsConfig';

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

export { storedSide } from '../services/source-impact-service/sideImpact';
export { sideImpact } from '../../packages/reports/src/components/harness/harness-compare/sideImpact';
