import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import { ModuleRuntimeAdapter } from '../adapters/ModuleRuntimeAdapter';
import type { ImpactReport } from '../core/impactTypes';
import { impactKernel } from '../utils/impactKernel';
import { emptySide, loadSide, type RevisionSide } from '../workflows/loadRevisions';
import { ImpactService } from './ImpactService';
import { SourceIndexService } from './SourceIndexService';

/** What one commit changed against its first parent, as the impact analysis computes it. */
export interface SourceImpact {
	/** The first parent the commit is compared with; null when it has none. */
	base: string | null;
	/** True when a global, unclassified or unresolved change put every test in scope. */
	expanded: boolean;
	units: ImpactReport['units'];
	/** Scenarios the change reaches. */
	scenarios: string[];
	uncertain: ImpactReport['uncertain'];
	changed: ImpactReport['changed'];
}

/**
 * Computes what a commit changed from the source of two commits alone: both trees are indexed
 * and their graphs compared, exactly as `harness impact` does. It needs no verification record,
 * so a history without evidence still states its real impact instead of an empty one.
 */
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
		const parent = await this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^1`]);
		try {
			const base = parent ? await this.side(parent) : emptySide();
			const report = await this.impact.compute(base, await this.side(commit));
			return {
				base: parent ?? null,
				expanded: report.expanded,
				units: report.units,
				scenarios: report.scenarios.affected,
				uncertain: report.uncertain,
				changed: report.changed
			};
		} catch {
			return undefined;
		}
	}

	/** Each tree is indexed once, however many commits are compared with it. */
	private side(commit: string): Promise<RevisionSide> {
		const known = this.sides.get(commit);
		if (known) return known;
		const loading = CommitTreeAdapter.open(this.root, commit).then((tree) =>
			loadSide(this.root, tree, this.indexer)
		);
		this.sides.set(commit, loading);
		return loading;
	}
}
