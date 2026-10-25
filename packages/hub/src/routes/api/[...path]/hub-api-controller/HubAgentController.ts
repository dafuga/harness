import type { Context } from './HubAgentController.types';
import { IpcRequestValidator } from '../../../../../../desktop/src/validators/IpcRequestValidator';
import { channels } from '../../../../../../desktop/src/models/DesktopBridge.types';
import { hubBody, hubHttp } from '../../../../utils/networking-security/hub-http/hubHttp';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
/** Membership is read for every operation. Write never confers owner administration. */
export class HubAgentController {
	constructor(private context: Context) {}
	async handle(): Promise<Response> {
		const { actor, executor, request } = this.context;
		const project = await this.authorize();
		if (!executor || !(await executor.available(project)))
			return hubHttp({ error: 'executor-offline' }, 503);
		if (request.method !== 'POST') return hubHttp({ error: 'method-denied' }, 405);
		const bearer = request.headers.get('authorization')?.startsWith('Bearer ');
		if (!bearer && request.headers.get('origin') !== new URL(request.url).origin)
			return hubHttp({ error: 'origin-denied' }, 403);
		const body = await hubBody(request),
			method = String(body.method);
		const payload = await this.payload(method, body);
		const authorize = async () => {
			await this.authorize();
		};
		await authorize();
		const result = await executor.execute({ project, actor, method, payload, authorize });
		await authorize();
		return hubHttp(result);
	}
	private async authorize() {
		const { api, actor, projectId, executor } = this.context;
		const project = await api.getProject(actor, projectId).catch(async (cause) => {
			await executor?.revoke(actor.id, projectId);
			throw cause;
		});
		if (!['owner', 'writer'].includes(project.role)) {
			await executor?.revoke(actor.id, projectId);
			return hubFail('forbidden');
		}
		return project;
	}

	private async payload(method: string, body: Record<string, unknown>): Promise<unknown> {
		const { projectId, projection, actor } = this.context;
		if (
			![
				'providers',
				'startRun',
				'cancelRun',
				'events',
				'openThread',
				'approve',
				'createPlan'
			].includes(method)
		)
			return hubFail('invalid-input');
		const input = agentInput(body.input, projectId);
		if (method === 'events') return eventCursor(input);
		const parsed = new IpcRequestValidator().parse(channels[method as keyof typeof channels], {
			...input,
			projectId
		});
		if (['providers', 'cancelRun'].includes(method)) return parsed;
		const revision = agentRevision(method, body);
		const snapshot = await projection.snapshot(actor, projectId, {
			branch: revision.branch,
			commit: revision.commit
		});
		if (
			!snapshot.revision.atTip ||
			snapshot.revision.commit !== revision.commit ||
			revision.branch === 'harness-evidence'
		)
			return hubFail('revision-mismatch');
		return { input: parsed, revision, requestId: body.requestId };
	}
}

function agentInput(value: unknown, projectId: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return hubFail('invalid-input');
	const input = value as Record<string, unknown>;
	if (input.projectId !== undefined && input.projectId !== projectId)
		return hubFail('invalid-input');
	return input;
}
function eventCursor(input: Record<string, unknown>) {
	if (
		typeof input.runId !== 'string' ||
		!Number.isSafeInteger(input.after) ||
		Number(input.after) < 0
	)
		return hubFail('invalid-input');
	return { runId: input.runId, after: input.after };
}
function agentRevision(method: string, body: Record<string, unknown>) {
	if (
		method === 'startRun' &&
		(typeof body.requestId !== 'string' ||
			!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.requestId))
	)
		return hubFail('invalid-input');
	const revision = body.revision as { branch?: unknown; commit?: unknown } | undefined;
	if (typeof revision?.branch !== 'string' || typeof revision.commit !== 'string')
		return hubFail('invalid-input');
	return { branch: revision.branch, commit: revision.commit };
}

export type { HubAgentPort } from './HubAgentController.types';
