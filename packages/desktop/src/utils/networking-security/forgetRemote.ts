import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
import { closedCapabilities } from '../projects-sessions/projectCapabilities';

/** A computer's projects are `local-…`; no other project is one of its. */
const local = (projectId: string | null | undefined) => Boolean(projectId?.startsWith('local-'));

/**
 * Whether what is shown is a project of the phone's own Hub account: a bridge that signs in by
 * itself, and a view the Hub was read for. No computer granted it, so none takes it away.
 */
export function accountView(workspace: Workspace): boolean {
	return (
		Boolean(workspace.bridge?.hostedStatus) &&
		workspace.capabilities.source === 'github' &&
		!local(workspace.snapshot?.project.id)
	);
}

/**
 * A phone that is no longer paired keeps nothing of the computer: no project, no view, no read
 * under way, and no address that names one of its projects. Its own Hub account is no part of
 * the computer: those projects stay listed and a view of one stays shown. True when there is
 * such an account, so that the caller lists it again.
 */
export function forgetRemote(workspace: Workspace, notice = ''): boolean {
	const account = Boolean(workspace.bridge?.hostedStatus);
	const kept = accountView(workspace);
	workspace.invalidate();
	workspace.projects = account
		? workspace.projects.filter((item) => item.kind !== 'local' && !local(item.id))
		: [];
	workspace.error = notice;
	if (kept) keepView(workspace);
	else forgetView(workspace);
	return account;
}

/** Only a navigation towards the computer ended; the account's view and its address stay. */
function keepView(workspace: Workspace): void {
	if (local(workspace.target)) workspace.target = null;
	if (local(workspace.selection.id)) workspace.selection.id = null;
}

function forgetView(workspace: Workspace): void {
	workspace.snapshot = null;
	workspace.entity = null;
	workspace.offline = null;
	workspace.capabilities = closedCapabilities;
	workspace.selection.id = null;
	workspace.target = null;
	const path = globalThis.location?.pathname ?? '/';
	if (path !== '/') globalThis.history?.replaceState({}, '', '/');
}
