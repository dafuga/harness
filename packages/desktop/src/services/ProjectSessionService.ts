import { realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { GitSourceAdapter } from '../adapters/GitSourceAdapter';
import { PlanningFacadeAdapter } from '../adapters/PlanningFacadeAdapter';
import { CatalogService } from './CatalogService';
import type { RevisionQuery } from '../models/DesktopBridge.types';
import type { ProjectSnapshot } from '../models/Desktop.types';
import { gitRead } from '../utils/gitRead';
export class ProjectSessionService {
	root: string | null = null;
	source: GitSourceAdapter | null = null;
	planning: PlanningFacadeAdapter | null = null;
	catalog: CatalogService | null = null;
	private query: RevisionQuery = { branch: null, commit: null };
	busy = false;
	async open(directory: string): Promise<ProjectSnapshot> {
		if (this.busy) throw new Error('Cancel or finish the current run before switching projects.');
		const root = await realpath(
			(await gitRead(directory, ['rev-parse', '--show-toplevel'])).trim()
		);
		this.root = root;
		this.source = new GitSourceAdapter(root);
		this.planning = await PlanningFacadeAdapter.open(root);
		this.catalog = new CatalogService(this.source, this.planning);
		this.query = { branch: null, commit: null };
		return this.snapshot(this.query);
	}
	async snapshot(query: RevisionQuery): Promise<ProjectSnapshot> {
		const { source, catalog, root } = this.requireProject();
		const revision = await source.revision(query);
		const branches = await source.branches(),
			current = branches.find((b) => b.current);
		const entities = await catalog.list(revision.commit);
		this.query = { branch: revision.branch, commit: query.commit };
		return {
			project: { name: basename(root), root },
			revision,
			branches,
			commits: await source.commits(revision.branch),
			entities,
			writable:
				query.commit === null &&
				revision.branch === current?.name &&
				revision.atTip &&
				revision.branch !== 'harness-evidence'
		};
	}
	requireProject() {
		if (!this.root || !this.source || !this.planning || !this.catalog)
			throw new Error('Open a project first.');
		return { root: this.root, source: this.source, planning: this.planning, catalog: this.catalog };
	}
	async mutable() {
		const project = this.requireProject(),
			revision = await project.source.revision(this.query);
		const current = (await project.source.branches()).find((b) => b.current);
		if (
			this.query.commit ||
			revision.branch !== current?.name ||
			!revision.atTip ||
			revision.branch === 'harness-evidence'
		)
			throw new Error(
				'Historical views and other branches are read-only. View the checked-out branch tip to make changes.'
			);
		return { ...project, revision };
	}
	async atBranch(branch: string) {
		const project = this.requireProject(),
			current = (await project.source.branches()).find((b) => b.current);
		if (current?.name !== branch)
			throw new Error('The checked-out branch changed during this run.');
		return project;
	}
}
