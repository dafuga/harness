import type { Context } from './HubApiController.types';
import { hostedCapabilities } from '../../../../../../desktop/src/utils/hostedCapabilities';
import type { Actor, CollaborationApi, AddCommentInput } from 'collaboration';
import type { HubApiRuntime } from '../../../../utils/networking-security/hubRuntime';
import { HubAgentController } from './HubAgentController';
import { HubRemoteController } from './HubRemoteController';
import { hubBody, hubHttp } from '../../../../utils/networking-security/hub-http/hubHttp';
import { hubHttpFailure, hubQuery } from './hubHttp';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import { hubEvidenceRead } from './hubEvidenceRead';

export class HubApiController {
	constructor(private runtime: HubApiRuntime) {}
	async handle(request: Request): Promise<Response> {
		try {
			const auth = await this.runtime.auth.handle(request);
			if (auth) return auth;
			const actor = await this.runtime.auth.actor(request);
			if (!actor) return hubHttp({ error: 'session-required' }, 401);
			return await this.projects(request, actor);
		} catch (error) {
			return hubHttpFailure(error);
		}
	}
	private async projects(request: Request, actor: Actor) {
		const parts = requestParts(request);
		if (parts[1] === 'remote')
			return new HubRemoteController(this.runtime.remote).handle(request, actor);
		if (!isProjectsRoute(parts)) return hubHttp({ error: 'not-found' }, 404);
		const { api, projection } = this.runtime.connect(),
			projectId = parts[2] ?? '';
		if (!projectId) return collection({ api, request, actor });
		const context = { api, projection, actor, request, projectId, executor: this.runtime.agent };
		return this.project(context, parts);
	}
	private async project(context: Context, parts: string[]) {
		if (!/^[a-f0-9-]{36}$/.test(context.projectId)) return hubFail('invalid-input');
		if (parts[3] === 'agent')
			return new HubAgentController({ ...context, executor: this.runtime.agent }).handle();
		if (['evidence', 'artifact'].includes(parts[3])) return hubEvidenceRead(context, parts[3]);
		if (context.request.method === 'GET') return readProject(context, parts[3] ?? '');
		return mutateProject(context, parts.slice(3));
	}
}

async function collection(c: Pick<Context, 'api' | 'request' | 'actor'>) {
	if (c.request.method === 'GET') return hubHttp(await c.api.listProjects(c.actor));
	if (c.request.method !== 'POST') return hubHttp({ error: 'method-denied' }, 405);
	const body = await hubBody(c.request);
	return hubHttp(
		await c.api.createProject(c.actor, {
			name: String(body.name ?? ''),
			repositoryId: Number(body.repositoryId)
		}),
		201
	);
}

async function readProject(c: Context, operation: string): Promise<Response> {
	const { actor, api, projection, projectId, request } = c;
	if (!operation) {
		const project = await api.getProject(actor, projectId);
		return hubHttp({ ...project, executionAvailable: await executable(c, project) });
	}
	if (operation === 'members') return hubHttp(await api.listMembers(actor, projectId));

	if (operation === 'moduleData') {
		const params = new URL(request.url).searchParams,
			commit = params.get('commit');
		if (commit && !/^[a-f0-9]{40}$/.test(commit)) return hubFail('invalid-input');
		return hubHttp(await projection.moduleData(actor, projectId, commit, params.get('branch')));
	}
	if (operation === 'registry') {
		const commit = new URL(request.url).searchParams.get('commit');
		if (!commit || !/^[a-f0-9]{40}$/.test(commit)) return hubFail('invalid-input');
		return hubHttp(await projection.registry(actor, projectId, commit));
	}

	if (operation === 'snapshot') {
		const p = new URL(request.url).searchParams;
		const snapshot = await projection.snapshot(actor, projectId, {
			branch: p.get('branch'),
			commit: p.get('commit')
		});
		const project = await api.getProject(actor, projectId),
			agents = await executable(c, project);
		return hubHttp({
			...snapshot,
			writable: agents && !p.get('commit') && snapshot.revision.atTip,
			capabilities: hostedCapabilities({ ...project, executionAvailable: agents }, projectId)
		});
	}
	return readEntity(c, operation);
}

async function readEntity(c: Context, operation: string): Promise<Response> {
	if (!['entity', 'history', 'source', 'messages', 'threads', 'image'].includes(operation))
		return hubHttp({ error: 'not-found' }, 404);
	const { actor, api, projection, projectId, request } = c,
		q = hubQuery(request);
	const reads = {
		history: () =>
			projection.history(actor, projectId, {
				...q,
				page: Number(new URL(request.url).searchParams.get('page') ?? '1')
			}),
		entity: () => projection.entity(actor, projectId, q),
		source: () => projection.source(actor, projectId, q),
		messages: () => projection.messages(actor, projectId, q),
		threads: () => api.listThreads(actor, { projectId, entityId: q.entityId, commit: q.commit })
	};
	if (operation === 'image')
		return new Response(new Uint8Array(await projection.image(actor, projectId, q)), {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'no-store',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	const read = Object.hasOwn(reads, operation) ? reads[operation as keyof typeof reads] : null;
	return read ? hubHttp(await read()) : hubHttp({ error: 'not-found' }, 404);
}

async function mutateProject(c: Context, parts: string[]): Promise<Response> {
	const { api, actor, projectId, request } = c,
		operation = parts[0];
	if (['runs', 'plans', 'approve', 'changes'].includes(operation))
		return hubHttp({ error: 'hosted-execution-denied' }, 403);
	const body = await hubBody(request);
	if (request.method === 'POST' && operation === 'comments') {
		if (body.projectId !== undefined && body.projectId !== projectId)
			return hubFail('invalid-input');
		return hubHttp(
			await api.addComment(actor, { ...body, projectId } as unknown as AddCommentInput),
			201
		);
	}
	return manageMembers(c, { parts, body });
}

async function manageMembers(
	c: Context,
	input: { parts: string[]; body: Record<string, unknown> }
) {
	const { api, actor, projectId, request } = c,
		{ parts } = input;
	if (request.method === 'DELETE' && parts[0] === 'members' && parts[1]) {
		await api.removeMember(actor, { projectId, memberId: parts[1] });
		return hubHttp({ ok: true });
	}
	if (request.method === 'POST' && parts[0] === 'invitations') return invitation(c, input);
	return hubHttp({ error: 'method-denied' }, 405);
}

async function invitation(c: Context, input: { parts: string[]; body: Record<string, unknown> }) {
	const { api, actor, projectId } = c,
		{ parts, body } = input;
	if (parts[2] === 'accept' && parts.length === 3)
		return hubHttp(
			await api.acceptInvitation(actor, {
				projectId,
				invitationId: parts[1],
				code: String(body.code ?? '')
			})
		);
	if (parts.length !== 1 || !['viewer', 'commenter', 'writer'].includes(String(body.role)))
		return hubFail('invalid-input');
	return hubHttp(
		await api.createInvitation(actor, {
			projectId,
			email: String(body.email ?? ''),
			role: body.role as 'viewer' | 'commenter' | 'writer'
		}),
		201
	);
}

async function executable(
	context: Context,
	project: Awaited<ReturnType<CollaborationApi['getProject']>>
) {
	return (
		['owner', 'writer'].includes(project.role) &&
		Boolean(await context.executor?.available(project))
	);
}

function requestParts(request: Request) {
	return new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

function isProjectsRoute(parts: string[]): boolean {
	return parts[0] === 'api' && parts[1] === 'projects';
}
