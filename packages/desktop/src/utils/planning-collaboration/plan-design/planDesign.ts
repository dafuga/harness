// @harness-uid u_w4s75s2hsf
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import type { DesignDraft } from '../../../models/planning-collaboration/PlanningPort.types';
import { RunCancelled } from '../../../models/agents-providers/AgentRunner.types';
import { mockupPlan, visualPlan } from '../mockupPlan';

function draftRevision(context: RunContext) {
	const thread = context.entity.threads.find((t) => t.id === context.request.threadId);
	if (!thread?.version || !thread.imageSha256) return undefined;
	return {
		version: thread.version,
		imageSha256: thread.imageSha256,
		region: thread.region,
		threadId: thread.id,
		...(thread.option ? { option: thread.option } : {})
	};
}

export async function planDesign(context: RunContext, proposal: string) {
	const { entity, signal, revision, request, session, planning, emit, id } = context;
	const visual = visualPlan(entity.category);
	const content = visual
		? await mockupPlan(context, proposal)
		: {
				prompt: proposal,
				notes: proposal,
				generator: { provider: request.provider, model: request.model }
			};
	const draft: DesignDraft = {
		entityId: entity.id,
		baseRevision: revision.commit,
		expectedLatest: entity.latestVersion,
		state: 'default',
		viewport: 'diagram',
		bytes: null,
		revises: draftRevision(context),
		...content
	};
	if (signal.aborted) throw new RunCancelled();
	await session.atBranch(revision.branch);
	if (signal.aborted) throw new RunCancelled();
	emit({
		runId: id,
		kind: 'status',
		phase: 'saving',
		detail: 'Committing an immutable design version'
	});
	const version = await planning.addDesign(draft);
	emit({ runId: id, kind: 'design', version: version.version, images: version.images });
	await planning.appendMessage({
		entityId: entity.id,
		threadId: request.threadId,
		author: 'agent',
		text: 'Saved ' + version.version + '. Review the design before requesting a Change.',
		mode: 'plan',
		provider: draft.generator.provider,
		model: draft.generator.model,
		version: version.version,
		imageSha256: version.images[0]?.sha256 ?? null
	});
	return 'Saved ' + version.version + ' for review.';
}
