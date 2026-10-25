import { unitMeasurements } from '../../../../utils/development-tooling/unitMeasurements';
import { CommitTreeAdapter } from '../../../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../../adapters/git-source-history/GitAdapter';
import { ModuleRuntimeAdapter } from '../../../../adapters/execution-runtimes/ModuleRuntimeAdapter';
import type { RequiredReason } from '../../../../core/development-tooling/explanationTypes';
import { impactKernel } from '../../../../utils/execution-runtimes/impact-kernel/impactKernel';
import { requiredReasons } from '../../../../utils/development-tooling/required-reasons/requiredReasons';
import {
	impactView,
	type SourceImpact,
	type StoredSide
} from '../../../../utils/explorer-ui/sideImpact';
import { storedSide } from './sideImpact';
import {
	emptySide,
	loadSide,
	type RevisionSide
} from '../../../../workflows/development-tooling/loadRevisions';
import { ImpactService } from '../../../reports-media/impact-service/ImpactService';
import { SourceIndexService } from '../../../development-tooling/source-index-service/SourceIndexService';

/**
 * Computes what a commit changed from the source of two commits alone: both trees are indexed
 * and their graphs compared, exactly as `harness impact` does. It needs no verification record,
 * so a history without evidence still states its real impact instead of an empty one.
 */
export { type SourceImpact } from '../../../../utils/explorer-ui/sideImpact';

export class SourceImpactService {
	private readonly sides = new Map<string, Promise<RevisionSide>>();
	private readonly indexer = new SourceIndexService();
	private readonly impact = new ImpactService(new ModuleRuntimeAdapter(impactKernel));
	private readonly git: GitAdapter;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
	}

	/** Undefined with nothing thrown when either tree cannot be read as source. */
	async of(commit: string): Promise<SourceImpact | undefined> {
		const parent = await this.parent(commit);
		try {
			const base = parent ? await this.side(parent) : emptySide();
			const report = await this.impact.compute(base, await this.side(commit));
			return impactView(report, parent ?? null);
		} catch {
			return undefined;
		}
	}

	/**
	 * Every change the commit made against its first parent that needs a reason, with the exact
	 * fingerprints `harness explain` binds a reason to. Undefined when either tree cannot be read.
	 */
	async reasons(commit: string): Promise<RequiredReason[] | undefined> {
		const parent = await this.parent(commit);
		try {
			const base = parent ? await this.side(parent) : emptySide();
			return requiredReasons(base, await this.side(commit));
		} catch {
			return undefined;
		}
	}

	/** The first parent of a commit: what its own change is measured from. */
	parent(commit: string): Promise<string | undefined> {
		return this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^1`]);
	}

	/** The side of a commit in the form the index stores; undefined when its tree is unreadable. */
	async stored(commit: string): Promise<StoredSide | undefined> {
		return this.side(commit).then(storedSide, () => undefined);
	}

	/** Static observations come from this exact commit even when no tests were recorded. */
	async measurements(commit: string) {
		const side = await this.side(commit).catch(() => undefined);
		if (!side) return [];
		return side.manifests.flatMap((unit) => unitMeasurements(unit, side.index.files, commit));
	}

	/** Retain the active comparison working set; older immutable trees can be reloaded. */
	private side(commit: string): Promise<RevisionSide> {
		const known = this.sides.get(commit);
		if (known) {
			this.sides.delete(commit);
			this.sides.set(commit, known);
			return known;
		}
		const loading = CommitTreeAdapter.open(this.root, commit).then((tree) =>
			loadSide(this.root, tree, this.indexer)
		);
		this.sides.set(commit, loading);
		if (this.sides.size > 4) this.sides.delete(this.sides.keys().next().value!);
		return loading;
	}
}
