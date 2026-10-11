import type { DesktopBridge, RevisionQuery } from '../../models/DesktopBridge.types';
import {
	categories,
	type Category,
	type EntityDetail,
	type ProjectSnapshot
} from '../../models/Desktop.types';

function navigation(url: string) {
	const pieces = url.split('/').filter(Boolean);
	const branch = pieces[1] === 'branch' ? decodeURIComponent(pieces[2]) : null;
	const nested = branch !== null && pieces[3] === 'commit';
	const offset = nested ? 5 : 3;
	let commit = pieces[1] === 'commit' ? pieces[2] : null;
	if (nested) commit = pieces[4];
	const category = pieces[offset] || 'pages';
	if (!categories.includes(category as Category)) throw new Error('Unknown catalog category');
	return {
		query: { branch, commit } as RevisionQuery,
		category: category as Category,
		entityId: pieces[offset + 1] ? decodeURIComponent(pieces[offset + 1]) : null
	};
}
class WorkspaceState {
	snapshot = $state<ProjectSnapshot | null>(null);
	entity = $state<EntityDetail | null>(null);
	category = $state<Category>('pages');
	error = $state('');
	busy = $state(false);
	bridge: DesktopBridge | undefined;
	private serial = 0;
	private pinnedCommit = false;
	connect(value: DesktopBridge | undefined) {
		this.bridge = value;
	}
	path(nextCategory = this.category, id?: string, suffix = '') {
		if (!this.snapshot) return '/';
		const revision = this.snapshot.revision;
		const prefix =
			revision.atTip && !this.pinnedCommit
				? `branch/${encodeURIComponent(revision.branch)}`
				: `branch/${encodeURIComponent(revision.branch)}/commit/${revision.commit}`;
		return `/harness/${prefix}/${nextCategory}${id ? `/${encodeURIComponent(id)}${suffix ? `/${suffix}` : ''}` : ''}`;
	}
	async navigate(url: string, push = true) {
		if (!this.bridge) return;
		const token = ++this.serial;
		this.busy = true;
		this.error = '';
		try {
			const route = navigation(url);
			const snapshot = await this.bridge.snapshot(route.query);
			const entity = route.entityId
				? await this.bridge.entity({ entityId: route.entityId, commit: snapshot.revision.commit })
				: null;
			if (token !== this.serial) return;
			this.snapshot = snapshot;
			this.pinnedCommit = route.query.commit !== null;
			this.entity = entity;
			this.category = route.category;
			if (push) globalThis.history.pushState({}, '', url);
		} catch (cause) {
			if (token === this.serial) this.error = String(cause);
		} finally {
			if (token === this.serial) this.busy = false;
		}
	}
	async openProject() {
		if (!this.bridge) return;
		this.busy = true;
		this.error = '';
		try {
			const selected = await this.bridge.openProject();
			if (selected) {
				this.snapshot = selected;
				this.pinnedCommit = false;
				await this.navigate(this.path('pages'));
			}
		} catch (cause) {
			this.error = String(cause);
		} finally {
			this.busy = false;
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
