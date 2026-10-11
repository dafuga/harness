import { resolve } from 'node:path';
import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import { WorkingTreeAdapter } from '../adapters/WorkingTreeAdapter';
import { fail } from '../core/errors';
import { evidenceMarker } from '../core/historyTypes';
import type { ImpactSide } from '../core/impactTypes';
import type { SourceTree } from '../core/sourceTypes';
import type { ComponentManifest } from '../core/unitTypes';
import { defaultUnitsConfig } from '../core/unitsConfig';
import { SourceIndexService, type SourceIndex } from '../services/SourceIndexService';
import { graphOf, loadUnits } from './loadUnits';

/** One revision with everything impact, reasons and measurements read from it. */
export interface RevisionSide extends ImpactSide {
	index: SourceIndex;
	/** Manifests exactly as stored at the revision, before reconciliation with source. */
	stored: ComponentManifest[];
	tree?: SourceTree;
}

export interface RevisionRange {
	root?: string;
	/** Revision to compare from; `HEAD` by default, `none` for an empty starting point. */
	base?: string;
	/** Revision to compare to; the working tree when omitted. */
	head?: string;
}

/** Uses the reconciled registry so files a stale manifest misses are still owned. */
export async function loadSide(
	root: string,
	tree: SourceTree,
	indexer: SourceIndexService
): Promise<RevisionSide> {
	const loaded = await loadUnits(root, tree, indexer);
	return {
		revision: tree.revision,
		config: loaded.config,
		entries: await tree.list(),
		manifests: loaded.fresh.manifests,
		scenarios: loaded.scenarios,
		graph: graphOf(loaded, loaded.fresh.manifests),
		index: loaded.index,
		stored: loaded.stored,
		tree
	};
}

/** The state before the first commit: nothing exists, so everything in head is new. */
export function emptySide(): RevisionSide {
	return {
		revision: 'none',
		config: defaultUnitsConfig,
		entries: [],
		manifests: [],
		scenarios: [],
		graph: { nodes: [], edges: [], uncertain: [] },
		index: { revision: 'none', files: new Map() },
		stored: []
	};
}

export async function openRange(
	range: RevisionRange
): Promise<{ root: string; base: RevisionSide; head: RevisionSide }> {
	const root = resolve(range.root ?? process.cwd());
	if (!(await new GitAdapter(root).isRepository())) {
		return fail('This command compares Git revisions; run it inside a repository.');
	}
	const indexer = new SourceIndexService();
	const open = async (reference: string): Promise<CommitTreeAdapter> => {
		const tree = await CommitTreeAdapter.open(root, reference);
		// Evidence is history about code. It is never impacted, explained or verified as code.
		if ((await tree.list()).some((entry) => entry.path === evidenceMarker)) {
			return fail(`"${reference}" is an evidence revision, not source; name a source commit.`);
		}
		return tree;
	};
	const base =
		range.base === 'none'
			? emptySide()
			: await loadSide(root, await open(range.base ?? 'HEAD'), indexer);
	const headTree = range.head ? await open(range.head) : new WorkingTreeAdapter(root);
	return { root, base, head: await loadSide(root, headTree, indexer) };
}

/** Reads commits of one repository as sides of a comparison, sharing one source index. */
export function commitLoader(root: string): (commit: string) => Promise<RevisionSide> {
	const indexer = new SourceIndexService();
	return async (commit) => loadSide(root, await CommitTreeAdapter.open(root, commit), indexer);
}
