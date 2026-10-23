import type { ProjectSessionService } from '../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { RunEvent, RunRequest } from '../../models/development-tooling/DesktopBridge.types';
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import type { ImageGenerator } from '../../models/agents-providers/AgentRunner.types';

export interface Preparation {
	session: ProjectSessionService;
	providers: ProviderDiscoveryService;
	generator: ImageGenerator;
	emit: (event: RunEvent) => void;
}

export async function imageModel(
	preparation: Preparation,
	request: Pick<RunRequest, 'mode'>,
	category: string
) {
	if (request.mode !== 'plan' || !['pages', 'layouts', 'components'].includes(category)) return '';
	const state = (await preparation.providers.list()).find((p) => p.id === 'codex');
	if (!state?.available || !state.imageGeneration)
		throw new Error('GPT Image requires the signed-in Codex image-generation capability.');
	const model = state.models.find((m) => m.isDefault);
	if (!model) throw new Error('Codex did not list a default image-orchestration model.');
	return model.id;
}

export function messageFor(
	context: Pick<RunContext, 'request'>,
	author: 'user' | 'agent',
	text: string
) {
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

export async function recordRunFailure(context: Omit<RunContext, 'entity'>, error: unknown) {
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

export { prepareRun } from '../../services/agents-providers/desktop-run-service/prepareRun';
