import type { Invitation, Member, ProjectSummary, Role } from 'collaboration';
import type { GithubRepositories, GithubStatus } from '../models/HubAuth.types';
import type { BrowserApi } from './browserApi';

const base = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`;

/** The link an owner hands over. It holds two identifiers; the code travels apart from it. */
export function invitationLink(origin: string, invitation: Invitation): string {
	const { projectId, id } = invitation;
	return `${origin}/invite/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`;
}

/** Projects, members and invitations. The server binds every request to the signed-in person. */
export function browserProjects(api: BrowserApi) {
	return {
		list: () => api.get<ProjectSummary[]>('/api/projects'),
		get: (projectId: string) => api.get<ProjectSummary>(base(projectId)),
		/** The repository is one the server listed; the server checks the owner's access again. */
		create: (input: { name: string; repositoryId: number }) =>
			api.send<ProjectSummary>('POST', '/api/projects', input),
		members: (projectId: string) => api.get<Member[]>(`${base(projectId)}/members`),
		invite: (projectId: string, input: { email: string; role: Exclude<Role, 'owner'> }) =>
			api.send<Invitation>('POST', `${base(projectId)}/invitations`, input),
		accept: (projectId: string, invitationId: string, code: string) =>
			api.send<ProjectSummary>(
				'POST',
				`${base(projectId)}/invitations/${encodeURIComponent(invitationId)}/accept`,
				{ code }
			),
		github: () => api.get<GithubStatus>('/api/github/status'),
		repositories: () => api.get<GithubRepositories>('/api/github/repositories')
	};
}
export type BrowserProjects = ReturnType<typeof browserProjects>;
