import { children, done, stamp } from './shared';
import type { PreviewCases } from './shared';
import { desktopData } from './sealedData';
import { workspacePath } from '../../../../../desktop/src/utils/projects-sessions/workspaceRoute';
import type { ProjectSnapshot } from '../../../../../desktop/src/models/Desktop.types';
const actor = { id: 'preview-person', name: 'Ada Example', email: 'ada@example.invalid' };
const project = {
	id: 'preview-project',
	name: 'Preview project',
	role: 'owner',
	sourceRepository: { owner: 'preview', name: 'example', fullName: 'preview/example' },
	createdAt: stamp
};
const proof = { email: actor.email, sent: true, expiresAt: '2026-10-20T10:10:05Z' };
/** `shown` is the desktop previews' project, which the web workspace reads through the hub API. */
export function hubPreview(id: string, shown: ProjectSnapshot) {
	const session = $state({
		actor,
		busy: false,
		error: '',
		status: { configured: true, actor, clientId: 'preview' },
		emailProof: id === 'hub.component.login-panel' ? proof : null,
		check: done,
		signOut: done,
		sendEmailCode: done,
		verifyEmail: done,
		challenge: async () => ({ nonce: 'preview', csrf: 'preview' }),
		signIn: done
	});
	const projects = {
		github: async () => ({ configured: true, connected: true, login: 'ada-example' }),
		repositories: async () => ({
			repositories: [{ id: 1, owner: 'preview', name: 'example', private: true }],
			truncated: false
		}),
		get: async () => project,
		list: async () => [project],
		members: async () => [
			{ actorId: actor.id, name: actor.name, email: actor.email, role: 'owner' }
		],
		create: async () => project,
		invite: done,
		accept: done
	};
	const hosted = hostedWorkspace(shown);
	// Any other read is answered as the pending sign-in request of a desktop app.
	const request = { resource: { kind: 'project', projectId: project.id }, status: 'pending' };
	const api = {
		get: async (path: string) => hosted.read(path) ?? request,
		send: async () => ({ resource: `project:${project.id}`, status: 'pending' }),
		bytes: hosted.bytes
	};
	const cases: PreviewCases = {
		'hub.component.account-menu': { projectId: project.id },
		'hub.component.email-proof-panel': { proof },
		'hub.component.hosted-workspace': {},
		'hub.component.hub-frame': { children },
		'hub.component.invitation-form': { projectId: project.id },
		'hub.component.invite-accept': { projectId: project.id, invitationId: 'preview-invitation' },
		'hub.component.login-panel': {},
		'hub.component.members-panel': { projectId: project.id },
		'hub.component.native-approval': { handoffId: 'preview-request' },
		'hub.component.project-create': { created: done },
		'hub.component.project-list': { projects: [project] }
	};
	return { context: { session, projects, api }, cases, addresses: hosted.addresses, project };
}

/**
 * The hub API of the web workspace over that project, answered as the hub projection answers
 * its owner: shared, read-only and open to comments. The workspace opens what its address names.
 */
function hostedWorkspace(shown: ProjectSnapshot) {
	const projectId = shown.project.id!;
	const at = `/api/projects/${encodeURIComponent(projectId)}`;
	const reads: Record<string, () => unknown> = {
		'/api/projects': () => [{ ...project, id: projectId, name: shown.project.name }],
		[`${at}/snapshot`]: () => hostedSnapshot(shown)
	};
	const address = workspacePath({ projectId, branch: shown.revision.branch, category: 'pages' });
	return {
		read: (path: string) => reads[path]?.(),
		// The committed design of the orders page: the one image its card on Pages shows.
		bytes: async (path: string) => {
			if (path !== `${at}/image`) throw new Error(`No preview image is served at ${path}`);
			return new Uint8Array(desktopData.design);
		},
		addresses: { 'hub.component.hosted-workspace': address }
	};
}

/** A snapshot as the hub serves it: no local folder, and nothing an agent could write. */
function hostedSnapshot(shown: ProjectSnapshot): ProjectSnapshot {
	return {
		...shown,
		project: { id: shown.project.id, name: shown.project.name, root: '' },
		writable: false,
		capabilities: {
			comments: true,
			agents: false,
			planning: false,
			approval: false,
			source: 'github'
		},
		cache: { identity: desktopData.identity, status: 'fresh', publication: 'remote' }
	};
}
