import type { FileClass, SourceGraph, TreeEntry, UncertainNode } from './sourceTypes';
import type { ComponentManifest, RuntimeKind, ScenarioManifest } from './unitTypes';
import type { UnitsConfig } from './unitsConfig';

export interface ChangedFile {
	path: string;
	status: 'added' | 'modified' | 'removed';
	classification: FileClass;
	/** Unit that owns the file, or the unit a changed manifest describes. */
	unit?: string;
}

export interface ImpactReport {
	/** Commit hash, or `working-tree`. */
	base: string;
	head: string;
	runtime: RuntimeKind;
	/** True when a global, unclassified or uncovered change selected every test. */
	expanded: boolean;
	changed: ChangedFile[];
	units: { direct: string[]; indirect: string[]; added: string[]; removed: string[] };
	tests: { selected: string[]; excluded: string[]; removed: string[] };
	scenarios: { affected: string[]; unaffected: string[] };
	uncertain: UncertainNode[];
}

/** One revision as the impact computation sees it. */
export interface ImpactSide {
	revision: string;
	config: UnitsConfig;
	entries: TreeEntry[];
	manifests: ComponentManifest[];
	scenarios: ScenarioManifest[];
	graph: SourceGraph;
}
