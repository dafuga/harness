import type { NativeAuthService } from './NativeAuthService';
import type { RemoteProjectPort } from '../models/ProjectContext.types';
import { CommentOutboxService } from './CommentOutboxService';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';
import { ProjectRegistryService } from './ProjectRegistryService';
import { RepositoryArbiterService } from './RepositoryArbiterService';
import { realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { GitSourceAdapter } from '../adapters/git-source-adapter/GitSourceAdapter';
import { PlanningFacadeAdapter } from '../adapters/planning-facade-adapter/PlanningFacadeAdapter';
import { CatalogService } from './catalog-service/CatalogService';
import type { RevisionQuery } from '../models/DesktopBridge.types';
import type { ProjectSnapshot } from '../models/Desktop.types';
import { gitRead } from '../utils/gitRead';
export class ProjectSessionService {
	root: string | null = null;
	projectId: string | null = null;
	pending = 0;
	private opening = false;
	readonly registry: ProjectRegistryService;
	readonly outbox: CommentOutboxService;
	readonly cache?: ProjectionCacheService;
	readonly remote?: RemoteProjectPort;
	readonly auth?: NativeAuthService;
	/** Shared by every session of this computer: who runs in a repository, and write order. */
	readonly arbiter: RepositoryArbiterService;
	constructor(
		options: {
			registry?: ProjectRegistryService;
			outbox?: CommentOutboxService;
			cache?: ProjectionCacheService;
			remote?: RemoteProjectPort;
			auth?: NativeAuthService;
			arbiter?: RepositoryArbiterService;
		} = {}
	) {
		this.registry = options.registry ?? new ProjectRegistryService();
		this.outbox = options.outbox ?? new CommentOutboxService();
		this.cache = options.cache;
		this.remote = options.remote;
		this.auth = options.auth;
		this.arbiter = options.arbiter ?? new RepositoryArbiterService();
	}
	assertProject(projectId?: string) {
		if (projectId !== undefined && projectId !== this.projectId)
			throw new Error('The requested project is not selected.');
	}
	source: GitSourceAdapter | null = null;
	planning: PlanningFacadeAdapter | null = null;
	catalog: CatalogService | null = null;
	private query: RevisionQuery = { branch: null, commit: null };
	busy = false;
	async open(directory: string): Promise<ProjectSnapshot> {
		if (this.busy || this.pending || this.opening)
			throw new Error('Cancel or finish the current run before switching projects.');
		this.opening = true;
		try {
			const root = await realpath(
				(await gitRead(directory, ['rev-parse', '--show-toplevel'])).trim()
			);
			const project = await this.registry.register(root);
			const source = new GitSourceAdapter(root);
			const planning = await PlanningFacadeAdapter.open(root);
			this.root = root;
			this.projectId = project.id;
			this.source = source;
			this.planning = planning;
			this.catalog = new CatalogService(source, planning);
			this.query = { branch: null, commit: null };
			return await this.snapshot(this.query);
		} finally {
			this.opening = false;
		}
	}

	async snapshot(query: RevisionQuery): Promise<ProjectSnapshot> {
		this.assertProject(query.projectId);
		const { source, catalog, root } = this.requireProject();
		const revision = await source.revision(query);
		const branches = await source.branches(),
			current = branches.find((b) => b.current);
		const entities = await catalog.list(revision.commit);
		this.query = { branch: revision.branch, commit: query.commit };
		return {
			project: {
				name: basename(root),
				root,
				id: this.projectId!,
				...(await gameKind(root, revision.commit))
			},
			capabilities: localCapabilities,
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

async function gameKind(
	root: string,
	commit: string
): Promise<{ kind?: 'game'; dimension?: '2d' | '3d' }> {
	try {
		const pkg = JSON.parse(await gitRead(root, ['show', commit + ':package.json']));
		return pkg.harness?.kind === 'game'
			? { kind: 'game', dimension: pkg.harness.dimension === '3d' ? '3d' : '2d' }
			: {};
	} catch {
		return {};
	}
}

const localCapabilities = {
	comments: true,
	agents: true,
	planning: true,
	approval: true,
	source: 'local',
	reason: 'Comments are saved as local pending drafts until connected.'
} as const;
