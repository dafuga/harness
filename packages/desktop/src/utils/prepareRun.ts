import { randomUUID } from 'node:crypto';
import type { ProjectSessionService } from '../services/ProjectSessionService';
import type { ProviderDiscoveryService } from '../services/ProviderDiscoveryService';
import type { RunEvent, RunRequest } from '../models/DesktopBridge.types';
import type { RunContext } from '../models/RunContext.types';
import type { ImageGenerator } from '../models/AgentRunner.types';
import { approvalMatch } from './approvalMatch';
interface Preparation {
	session: ProjectSessionService;
	providers: ProviderDiscoveryService;
	generator: ImageGenerator;
	emit: (event: RunEvent) => void;
}
async function imageModel(preparation: Preparation, request: RunRequest, category: string) {
	if (request.mode !== 'plan' || !['pages', 'components'].includes(category)) return '';
	const state = (await preparation.providers.list()).find((p) => p.id === 'codex');
	if (!state?.available || !state.imageGeneration)
		throw new Error('GPT Image requires the signed-in Codex image-generation capability.');
	const model = state.models.find((m) => m.isDefault);
	if (!model) throw new Error('Codex did not list a default image-orchestration model.');
	return model.id;
}
export async function prepareRun(
	preparation: Preparation,
	request: RunRequest,
	controller: AbortController
): Promise<RunContext> {
	const project = await preparation.session.mutable(),
		entity = await project.catalog.entity(request.entityId, project.revision.commit);
	const runner = await preparation.providers.select(
		request.provider,
		request.model,
		request.effort
	);
	if (!entity.threads.some((t) => t.id === request.threadId))
		throw new Error('Thread does not belong to this entity.');
	approvalMatch(entity, request);
	const context: RunContext = {
		...project,
		...preparation,
		id: randomUUID(),
		request,
		entity,
		runner,
		imageModel: await imageModel(preparation, request, entity.category),
		signal: controller.signal
	};
	await project.planning.appendMessage(messageFor(context, 'user', request.text));
	return context;
}
export function messageFor(context: RunContext, author: 'user' | 'agent', text: string) {
	const request = context.request,
		version = request.approval?.version ?? null,
		imageSha256 = request.approval?.imageHashes[0] ?? null;
	return {
		entityId: request.entityId,
		threadId: request.threadId,
		author,
		text,
		mode: request.mode,
		provider: request.provider,
		model: request.model,
		version,
		imageSha256
	};
}
export async function recordRunFailure(context: RunContext, error: unknown) {
	if (context.failureRecorded) return;
	await context.session.atBranch(context.revision.branch);
	const change =
		context.request.mode === 'change'
			? {
					status: context.signal.aborted ? ('cancelled' as const) : ('failed' as const),
					error: String(error).slice(0, 600)
				}
			: undefined;
	await context.planning.appendMessage({
		...messageFor(
			context,
			'agent',
			(error instanceof Error ? error.message : 'Run failed.').slice(0, 200)
		),
		change
	});
}
