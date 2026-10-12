import type { DesktopBridge } from '../../models/DesktopBridge.types';
import type { Category, EntityDetail, ProjectSnapshot } from '../../models/Desktop.types';
import type { RemotePorts } from '../../models/Environment.types';
import type { DesktopProject, ProjectCapabilities } from '../../models/ProjectContext.types';
import { cacheStatus, type OfflineView } from '../../utils/cacheStatus';
import { loadWorkspace, type LoadedWorkspace } from '../../utils/loadWorkspace';
import { openProject } from '../../utils/openProject';
import { closedCapabilities } from '../../utils/projectCapabilities';
import { listedProjects } from '../../utils/projectList';
import { workspacePath, workspaceRoute } from '../../utils/workspaceRoute';
import type { RouteSuffix, WorkspaceRoute } from '../../utils/workspaceRoute';

class WorkspaceState {
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
	private serial = 0;
	private listing = 0;
	private queue: Promise<unknown> = Promise.resolve();
	private release: (() => void) | undefined;
	/** Cache events are heard from here on; connecting nothing ends the subscription. */
	connect(value: DesktopBridge | undefined, options: { local?: boolean } & RemotePorts = {}) {
		this.release?.();
		this.bridge = value;
		this.local = options.local ?? true;
		const { host, phone, links } = options;
		this.remote = { host, phone, links };
		this.release = value?.onCacheStatus?.((event) => cacheStatus(this, event));
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
		const projectId = this.projectId;
		return projectId ? { projectId } : {};
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
		return workspacePath({ category: this.category, ...target, projectId: this.projectId });
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
			if (push) globalThis.history.pushState({}, '', shown);
			else if (shown !== url) globalThis.history.replaceState({}, '', shown);
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
	/** All of it changes together, so nothing of another project stays; returns the shown address. */
	private show(route: WorkspaceRoute, loaded: LoadedWorkspace) {
		this.snapshot = loaded.snapshot;
		this.pinned = route.commit !== null;
		this.entity = loaded.entity;
		this.capabilities = loaded.capabilities;
		this.offline = loaded.offline;
		this.category = route.category;
		this.suffix = route.suffix;
		return this.path(route.category, route.entityId ?? undefined, route.suffix ?? '');
	}
	openProject() {
		return openProject(this);
	}
	/** Keeps the category; entity, branch and commit belong to the project that is left. */
	async switchProject(projectId: string) {
		if (!projectId || projectId === this.projectId) return;
		await this.navigate(workspacePath({ projectId, category: this.category }));
	}
	async loadProjects() {
		if (!this.bridge) return;
		const listing = ++this.listing;
		try {
			const listed = await listedProjects(this.bridge);
			if (listing === this.listing) this.projects = listed;
		} catch (cause) {
			if (listing === this.listing) this.error = String(cause);
		}
	}
	async refresh() {
		await this.navigate(globalThis.location.pathname, false);
	}
}
export function createWorkspaceStore() {
	return new WorkspaceState();
}
export type Workspace = WorkspaceState;
