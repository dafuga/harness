import type { ComplexityCoverage } from '../../utils/development-tooling/complexityCoverage';
import type { ReferenceVia, SourceLanguage } from '../../utils/development-tooling/scanImports';
import type { SourceBlock } from '../../utils/development-tooling/sourceBlocks';
import type { ContractItem } from './unitTypes';

export type FileClass = 'source' | 'test' | 'global' | 'registry' | 'ignored' | 'other';
export type UncertainReason =
	| 'non-literal-import'
	| 'unresolved-import'
	| 'unclassified-change'
	| 'uncovered-change'
	| 'global-change';

export interface ExportedSymbol {
	name: string;
	kind: 'function' | 'class' | 'method' | 'const' | 'type' | 'default' | 'reexport' | 'component';
	inputs: ContractItem[];
	output?: string;
}

export interface ResolvedReference {
	via: ReferenceVia;
	typeOnly: boolean;
	/** Repository-relative path when the reference resolves to a tracked file. */
	path?: string;
	/** Package or runtime-provided module name when the reference leaves the repository. */
	external?: string;
	uncertain?: { reason: UncertainReason; detail: string };
}

export interface SourceFile {
	path: string;
	/** Git blob hash of the contents. */
	hash: string;
	bytes: number;
	lines: number;
	language: SourceLanguage;
	classification: FileClass;
	workspace: string;
	/** Conventional unit identity of a source file, before registry ownership is applied. */
	identity?: { id: string; kind: string; name: string };
	/** False when the file was not read: nothing is known about its content, not even its size. */
	read: boolean;
	/** Parsed execution facts; absent or unknown never exempts a file from runtime evidence. */
	execution?: 'declarative' | 'runtime' | 'unknown';
	/** Whether its decision points are counted, absent by nature, or not counted at all. */
	decisions: ComplexityCoverage;
	references: ResolvedReference[];
	blocks: SourceBlock[];
	exports: ExportedSymbol[];
	errors: string[];
}

export interface TreeEntry {
	path: string;
	hash: string;
}

/** A readable snapshot of repository files: the working tree or one exact commit. */
export interface SourceTree {
	revision: string;
	list(): Promise<TreeEntry[]>;
	read(path: string): Promise<string>;
}

export interface GraphNode {
	id: string;
	kind: 'source' | 'test' | 'global' | 'registry' | 'other' | 'unit' | 'scenario';
	unit?: string;
}

export interface GraphEdge {
	from: string;
	to: string;
	via: string;
}

export interface UncertainNode {
	node: string;
	reason: UncertainReason;
	detail: string;
}

export interface SourceGraph {
	nodes: GraphNode[];
	edges: GraphEdge[];
	uncertain: UncertainNode[];
}
