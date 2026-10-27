import type { RevisionSide, RevisionRange } from './loadRevisions.types';
import type {
	ReasonSide,
	ReasonFile
} from '../../utils/development-tooling/required-reasons/requiredReasons.types';
import { resolve } from 'node:path';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { WorkingTreeAdapter } from '../../adapters/git-source-history/WorkingTreeAdapter';
import { fail } from '../../core/development-tooling/errors';
import { evidenceMarker } from '../../core/git-source-history/historyTypes';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import { defaultUnitsConfig } from '../../core/development-tooling/unitsConfig';
import { verifyConfigFile } from '../../core/verification-evidence/verifyTypes';
import { SourceIndexService } from '../../services/development-tooling/source-index-service/SourceIndexService';
import { reasonDeclarationHash } from '../../utils/development-tooling/required-reasons/requiredReasons';
import { writingHeld } from '../../utils/git-source-history/writing-limits/writingLimits';
import { graphOf, loadUnits } from './load-units/loadUnits';

/** Uses the reconciled registry so files a stale manifest misses are still owned. */
export async function loadSide(
	root: string,
	tree: SourceTree,
	indexer: SourceIndexService
): Promise<RevisionSide> {
	const loaded = await loadUnits(root, tree, indexer);
	const verification = await tree.read(verifyConfigFile).catch(() => undefined);
	return {
		writing: writingHeld(verification),
		revision: tree.revision,
		config: loaded.config,
		entries: await tree.list(),
		manifests: loaded.fresh.manifests,
		scenarios: loaded.scenarios,
		graph: graphOf(loaded, loaded.fresh.manifests),
		index: loaded.index,
		stored: loaded.stored,
		errors: loaded.errors,
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
export function commitLoader(root: string): (commit: string) => Promise<ReasonSide> {
	const indexer = new SourceIndexService();
	return async (commit) =>
		compactReasonSide(await loadSide(root, await CommitTreeAdapter.open(root, commit), indexer));
}

function compactReasonSide(side: RevisionSide): ReasonSide {
	const files = new Map<string, ReasonFile>();
	const manifests = side.manifests
		.filter((unit) => {
			if (unit.status !== 'active') return false;
			let present = false;
			for (const path of unit.owns.source) {
				const file = side.index.files.get(path);
				if (!file) continue;
				files.set(path, {
					hash: file.hash,
					blocks: file.blocks.map(({ name, hash }) => ({ name, hash }))
				});
				present = true;
			}
			return present;
		})
		.map((unit) => ({
			id: unit.id,
			status: unit.status,
			owns: { source: unit.owns.source },
			declarationHash: reasonDeclarationHash(unit)
		}));
	return { index: { files }, manifests, writing: side.writing };
}

export type { RevisionSide, RevisionRange } from './loadRevisions.types';
