import { children, done, stamp } from './shared';
import type { PreviewCases } from './shared';
export function hubPreview(id: string) {
	const actor = { id: 'preview-person', name: 'Ada Example', email: 'ada@example.invalid' };
	const project = {
		id: 'preview-project',
		name: 'Preview project',
		role: 'owner',
		sourceRepository: { owner: 'preview', name: 'example', fullName: 'preview/example' },
		createdAt: stamp
	};
	const proof = { email: actor.email, sent: true, expiresAt: '2026-10-20T10:10:05Z' };
	const session = $state({
		actor,
		busy: false,
		error: '',
		status: { configured: true, actor, clientId: 'preview' },
		emailProof: id === 'hub.component.login-panel' ? proof : null,
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
	const api = {
		get: async () => ({ resource: { kind: 'project', projectId: project.id }, status: 'pending' }),
		send: async () => ({ resource: `project:${project.id}`, status: 'pending' })
	};
	const cases: PreviewCases = {
		'hub.component.account-menu': { projectId: project.id },
		'hub.component.email-proof-panel': { proof },
		'hub.component.hub-frame': { children },
		'hub.component.invitation-form': { projectId: project.id },
		'hub.component.invite-accept': { projectId: project.id, invitationId: 'preview-invitation' },
		'hub.component.login-panel': {},
		'hub.component.members-panel': { projectId: project.id },
		'hub.component.native-approval': { handoffId: 'preview-request' },
		'hub.component.project-create': { created: done },
		'hub.component.project-list': { projects: [project] }
	};
	return { context: { session, projects, api }, cases };
}
