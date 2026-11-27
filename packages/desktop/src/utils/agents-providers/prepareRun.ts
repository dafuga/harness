// @harness-uid u_fq2qh7235c
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import type { RunMode, ProviderId } from '../../models/development-tooling/Desktop.types';

export function messageFor(
	context: Pick<RunContext, 'request'>,
	author: 'user' | 'agent',
	text: string
): {
	entityId: string;
	threadId: string;
	author: 'user' | 'agent';
	text: string;
	mode: RunMode;
	provider: ProviderId;
	model: string;
	version: string | null;
	imageSha256: string | null;
} {
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

export type { Preparation } from './prepareRun.types';
