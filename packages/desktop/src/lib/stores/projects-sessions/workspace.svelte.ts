import { createDeploymentActivityStore } from '../deploymentActivity.svelte';
import { createDeploymentsStore } from '../deployments.svelte';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type {
	Category,
	EntityDetail,
	ProjectSnapshot
} from '../../../models/development-tooling/Desktop.types';
import type { RemotePorts } from '../../../models/development-tooling/Environment.types';
import type {
	CacheStatus,
	DesktopProject,
	ProjectCapabilities
} from '../../../models/projects-sessions/ProjectContext.types';
import {
	cacheStatus,
	deniedNotice,
	everyProject
} from '../../../utils/projects-sessions/cache-status/cacheStatus';
import type { OfflineView } from '../../../utils/projects-sessions/cache-status/cacheStatus';
import {
	loadWorkspace,
	type LoadedWorkspace
} from '../../../utils/projects-sessions/load-workspace/loadWorkspace';
import { openProject } from '../../../utils/projects-sessions/openProject';
import { closedCapabilities } from '../../../utils/projects-sessions/projectCapabilities';
import { listedProjects } from '../../../utils/projects-sessions/projectList';
import { workspacePath, workspaceRoute } from '../../../utils/projects-sessions/workspaceRoute';
import type { RouteSuffix, WorkspaceRoute } from '../../../utils/projects-sessions/workspaceRoute';
class WorkspaceState {
	readonly activity = createDeploymentActivityStore(this);
	readonly deployments = createDeploymentsStore(this);
	routeProject = true;
	onNavigate?: (url: string, push: boolean) => void;
	snapshot = $state<ProjectSnapshot | null>(null);
	entity = $state<EntityDetail | null>(null);
	category = $state<Category>('pages');
	suffix = $state<RouteSuffix>(null);
	projects = $state<DesktopProject[]>([]);
	capabilities = $state<ProjectCapabilities>(closedCapabilities);
	/** True while the address names a commit, also when that commit is the tip. */
	pinned = $state(false);
	/** Set while the shown project is a cached copy: read-only, its membership not verified. */
	offline = $state<OfflineView | null>(null);
	error = $state('');
	busy = $state(false);
	bridge: DesktopBridge | undefined;
	/** Whether the bridge can add a folder of this device as a project. */
	local = $state(true);
	/** The control port of the environment: phone access on a desktop, the computer on a phone. */
	remote = $state.raw<RemotePorts>({});
	/** The project a navigation is under way to; the one the bridge was last told to select. */
	target: string | null = null;
	readonly selection = { id: null as string | null };
	/** True while the last discovery was a kept copy, which says nothing of current membership. */
	listedOffline = false;
	private serial = 0;
	private listing = 0;
	private queue: Promise<unknown> = Promise.resolve();
	private release: (() => void) | undefined;
	/** Cache events are heard from here on; connecting nothing ends the subscription. */
	connect(value: DesktopBridge | undefined, options: { local?: boolean } & RemotePorts = {}) {
		this.release?.();
		this.bridge = value;
		this.local = options.local ?? true;
		this.remote = { host: options.host, phone: options.phone };
		this.release = value?.onCacheStatus?.((event) => heard(this, event));
	}
	/** A read or a listing that is under way is no longer shown when it answers. */
	invalidate() {
		this.serial++;
		this.listing++;
		this.busy = false;
	}
	get projectId(): string | null {
		return this.snapshot?.project.id ?? null;
	}
	/** What every request for the shown project carries; empty without project identities. */
	get context(): { projectId?: string } {
		return this.projectId ? { projectId: this.projectId } : {};
	}
	path(nextCategory = this.category, id?: string, suffix = '') {
		if (!this.snapshot) return '/';
		const { branch, commit, atTip } = this.snapshot.revision;
		const entity = { entityId: id ?? null, suffix: suffix as RouteSuffix };
		const shown = atTip && !this.pinned ? null : commit;
		return this.link({ branch, commit: shown, category: nextCategory, ...entity });
	}
	/** A link inside the shown project: a branch tip, or a full commit of that branch. */
	link(target: Partial<Omit<WorkspaceRoute, 'projectId'>>) {
		return workspacePath({
			category: this.category,
			...target,
			projectId: this.routeProject ? this.projectId : null
		});
	}
	async navigate(url: string, push = true) {
		if (!this.bridge) return;
		const token = ++this.serial;
		this.busy = true;
		this.error = '';
		try {
			const route = workspaceRoute(url);
			this.target = route.projectId;
			const loaded = await this.load(route, token);
			if (!loaded || token !== this.serial) return;
			const shown = this.show(route, loaded);
			if (shouldNavigate(push, shown, url)) (this.onNavigate ?? browserNavigate)(shown, push);
		} catch (cause) {
			if (token === this.serial) this.error = String(cause);
		} finally {
			if (token === this.serial) this.busy = false;
		}
	}
	/** One read at a time, as the bridge keeps one selected project; superseded reads are skipped. */
	private load(route: WorkspaceRoute, token: number): Promise<LoadedWorkspace | null> {
		const run = this.queue.then(() =>
			token === this.serial ? loadWorkspace(this.bridge!, route, this.selection) : null
		);
		this.queue = run.catch(() => undefined);
		return run;
	}
	/** All of it changes at once, an entity under its category here; returns the shown address. */
	private show(route: WorkspaceRoute, loaded: LoadedWorkspace) {
		this.snapshot = loaded.snapshot;
		this.pinned = route.commit !== null;
		this.entity = loaded.entity;
		this.capabilities = loaded.capabilities;
		this.offline = loaded.offline;
		this.category = loaded.entity?.category ?? route.category;
		this.suffix = route.suffix;
		return this.path(this.category, route.entityId ?? undefined, route.suffix ?? '');
	}
	openProject = () => openProject(this);
	/** Keeps the category; entity, branch and commit belong to the project that is left. */
	switchProject = (projectId: string) => switchProject(this, projectId);
	async loadProjects() {
		if (!this.bridge) return;
		const listing = ++this.listing;
		try {
			const listed = await listedProjects(this.bridge);
			if (listing === this.listing) reconcile(this, listed);
		} catch (cause) {
			if (listing === this.listing) this.error = String(cause);
		}
	}
	refresh = () => this.navigate(globalThis.location.pathname, false);
}
export function createWorkspaceStore() {
	return new WorkspaceState();
}
export type Workspace = WorkspaceState;
/** A discovery event says whether the list it precedes is current; every event is applied. */
function heard(workspace: WorkspaceState, event: CacheStatus) {
	if (event.projectId === everyProject) workspace.listedOffline = event.status === 'offline';
	cacheStatus(workspace, event);
}
/**
 * Takes a fresh list. A shown shared project it no longer names leaves the page with what it
 * allowed and any navigation towards it; a kept copy of the list removes nothing.
 */
function reconcile(workspace: WorkspaceState, listed: DesktopProject[]) {
	workspace.projects = listed;
	const id = workspace.projectId;
	const shared = workspace.capabilities.source === 'github';
	if (!id || !shared || workspace.listedOffline) return;
	if (listed.some((item) => item.id === id)) return;
	workspace.invalidate();
	workspace.snapshot = null;
	workspace.entity = null;
	workspace.offline = null;
	workspace.capabilities = closedCapabilities;
	workspace.error = deniedNotice;
	if (workspace.target === id) workspace.target = null;
	if (workspace.selection.id === id) workspace.selection.id = null;
}

function browserNavigate(shown: string, push: boolean) {
	if (push) globalThis.history.pushState({}, '', shown);
	else globalThis.history.replaceState({}, '', shown);
}

function shouldNavigate(push: boolean, shown: string, asked: string) {
	return push || shown !== asked;
}

/** A project selection keeps the category and leaves its former revision behind. */
async function switchProject(workspace: Workspace, projectId: string) {
	if (!projectId || projectId === workspace.projectId) return;
	await workspace.navigate(workspacePath({ projectId, category: workspace.category }));
}
