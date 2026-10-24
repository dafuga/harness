import type { RouteSuffix, WorkspaceRoute, WorkspaceTarget } from './workspaceRoute.types';
import { categories } from '../../models/development-tooling/Desktop.types';
import type { Category } from '../../models/development-tooling/Desktop.types';
import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';

/**
 * The sections of an entity that have an address of their own; its overview has none.
 * `relationships` is the former address of what `used-in` and `uses` show: it is still read.
 */
export const routeSuffixes = [
	'apis',
	'designs',
	'plan',
	'used-in',
	'uses',
	'relationships',
	'evidence',
	'examples',
	'states',
	'history',
	'source',
	'details'
] as const;
/** Labels and addresses of the shared entity page sections. */
export const workspaceSections = {
	Overview: '',
	APIs: 'apis',
	Designs: 'designs',
	Plan: 'plan',
	'Used In': 'used-in',
	Uses: 'uses',
	Evidence: 'evidence',
	Examples: 'examples',
	States: 'states',
	History: 'history',
	Source: 'source'
} as const;

const fullCommit = /^[a-f0-9]{40}$/;
const pieces = (path: string) => path.split('/').filter(Boolean);

/** The segments after an optional `/projects/{id}` prefix; null when it is no workspace address. */
function scope(path: string): { projectId: string | null; rest: string[] } | null {
	const all = pieces(path);
	if (all[0] === 'harness') return { projectId: null, rest: all };
	if (all[0] !== 'projects' || all[2] !== 'harness') return null;
	return { projectId: decodeURIComponent(all[1]), rest: all.slice(2) };
}
function revision(rest: string[]) {
	const branch = rest[1] === 'branch' ? decodeURIComponent(rest[2] ?? '') : null;
	if (branch !== null && rest[3] === 'commit') return { branch, commit: rest[4] ?? '', offset: 5 };
	if (branch !== null) return { branch, commit: null, offset: 3 };
	if (rest[1] === 'commit') return { branch, commit: rest[2] ?? '', offset: 3 };
	return { branch, commit: null, offset: 1 };
}
function suffix(value: string | undefined): RouteSuffix {
	if (value === 'details') return 'source';
	return routeSuffixes.find((known) => known === value) ?? null;
}

export function isWorkspacePath(path: string): boolean {
	return scope(path) !== null;
}

export function workspaceRoute(path: string): WorkspaceRoute {
	const found = scope(path);
	if (!found) throw new Error('Not a workspace address');
	const { branch, commit, offset } = revision(found.rest);
	if (commit !== null && !fullCommit.test(commit))
		throw new Error('A commit link needs the full commit hash');
	const requested = found.rest[offset] || 'pages';
	const category = requested === 'shells' ? 'layouts' : requested;
	if (!categories.includes(category as Category)) throw new Error('Unknown catalog category');
	const entity = found.rest[offset + 1];
	return {
		projectId: found.projectId,
		branch,
		commit,
		category: category as Category,
		entityId: entity ? decodeURIComponent(entity) : null,
		suffix: suffix(found.rest[offset + 2])
	};
}

/** The one place a workspace address is written; a branch keeps its slashes encoded. */
export function workspacePath(target: WorkspaceTarget): string {
	const project = target.projectId ? `/projects/${encodeURIComponent(target.projectId)}` : '';
	const branch = target.branch ? `/branch/${encodeURIComponent(target.branch)}` : '';
	const commit = target.commit ? `/commit/${target.commit}` : '';
	const section = target.entityId && target.suffix ? `/${suffix(target.suffix ?? undefined)}` : '';
	const entity = target.entityId ? `/${encodeURIComponent(target.entityId)}${section}` : '';
	return `${project}/harness${branch}${commit}/${target.category}${entity}`;
}

/** Game views follow the shown revision and are available only to a local game bridge. */
export function workspaceGameViews(
	workspace: Pick<Workspace, 'snapshot' | 'projectId' | 'local' | 'bridge'>
): string | null {
	const { snapshot, projectId, local, bridge } = workspace;
	const available = !!bridge?.gameRead;
	if (snapshot?.project.kind !== 'game' || !projectId || !local || !available) return null;
	const views = `/game?projectId=${encodeURIComponent(projectId)}`;
	return snapshot.writable
		? views
		: `${views}&readonly=1&commit=${encodeURIComponent(snapshot.revision.commit)}`;
}

export type { RouteSuffix, WorkspaceRoute, WorkspaceTarget } from './workspaceRoute.types';
