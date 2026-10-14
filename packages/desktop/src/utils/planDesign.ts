import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunContext } from '../models/RunContext.types';
import type { DesignDraft } from '../models/PlanningPort.types';
import { RunCancelled } from '../models/AgentRunner.types';
import { designPrompt } from './designPrompt';
function draftFor(context: RunContext, prompt: string): DesignDraft {
	const thread = context.entity.threads.find((t) => t.id === context.request.threadId),
		visual = ['pages', 'shells', 'components'].includes(context.entity.category);
	const draft: DesignDraft = {
		entityId: context.entity.id,
		prompt,
		generator: visual
			? { provider: 'codex', model: context.imageModel }
			: { provider: context.request.provider, model: context.request.model },
		baseRevision: context.revision.commit,
		expectedLatest: context.entity.latestVersion,
		state: thread?.state ?? 'default',
		viewport: thread?.viewport ?? (visual ? 'desktop' : 'diagram'),
		bytes: null
	};
	if (!visual) draft.notes = prompt;
	draft.revises = draftRevision(thread);
	return draft;
}
function draftRevision(thread: RunContext['entity']['threads'][number] | undefined) {
	if (!thread?.version || !thread.imageSha256) return undefined;
	return {
		version: thread.version,
		imageSha256: thread.imageSha256,
		region: thread.region,
		threadId: thread.id
	};
}
function imageNotes(context: RunContext, revised: string | null, proposal: string) {
	let notes =
		'Design direction: ' +
		context.request.provider +
		' / ' +
		context.request.model +
		'. Image orchestration: Codex / ' +
		context.imageModel +
		'. The image capability does not expose its underlying GPT Image model identifier.' +
		'\nProposal:\n' +
		proposal;
	if (revised) notes += '\nRevised image prompt: ' + revised;
	return notes;
}
async function generatedBytes(context: RunContext, draft: DesignDraft, directory: string) {
	let reference: string | null = null;
	if (draft.revises) {
		reference = join(directory, 'reference.png');
		await writeFile(
			reference,
			await context.planning.image({
				entityId: draft.entityId,
				version: draft.revises.version,
				sha256: draft.revises.imageSha256,
				revision: context.revision.commit
			})
		);
	}
	context.emit({
		runId: context.id,
		kind: 'status',
		phase: 'generating',
		detail: 'Generating the design with GPT Image'
	});
	const proposal = draft.prompt;
	draft.prompt = designPrompt(context, proposal);
	const result = await context.generator.generateImage({
		cwd: directory,
		prompt: draft.prompt,
		reference,
		model: context.imageModel,
		signal: context.signal,
		onStatus: (detail) =>
			context.emit({ runId: context.id, kind: 'status', phase: 'generating', detail })
	});
	draft.notes = imageNotes(context, result.revisedPrompt, proposal);
	return result.bytes;
}
export async function planDesign(context: RunContext, prompt: string) {
	const draft = draftFor(context, prompt),
		directory = await mkdtemp(join(tmpdir(), 'harness-design-'));
	try {
		if (draft.notes === undefined) draft.bytes = await generatedBytes(context, draft, directory);
		if (context.signal.aborted) throw new RunCancelled();
		await context.session.atBranch(context.revision.branch);
		context.emit({
			runId: context.id,
			kind: 'status',
			phase: 'saving',
			detail: 'Committing an immutable design version'
		});
		const version = await context.planning.addDesign(draft);
		context.emit({
			runId: context.id,
			kind: 'design',
			version: version.version,
			images: version.images
		});
		await context.planning.appendMessage({
			entityId: draft.entityId,
			threadId: context.request.threadId,
			author: 'agent',
			text: 'Saved ' + version.version + '. Review the design before requesting a Change.',
			mode: 'plan',
			provider: context.request.provider,
			model: context.request.model,
			version: version.version,
			imageSha256: version.images[0]?.sha256 ?? null
		});
		return 'Saved ' + version.version + ' for review.';
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
