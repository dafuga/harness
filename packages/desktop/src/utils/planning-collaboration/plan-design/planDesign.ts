import type { Ask } from './planDesign.types';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import type { DesignDraft } from '../../../models/planning-collaboration/PlanningPort.types';
import { RunCancelled } from '../../../models/agents-providers/AgentRunner.types';
import { designPrompt } from '../designPrompt';
import { designCount } from '../designCount';
import { designDirections } from './designDirections';

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
		threadId: thread.id,
		...(thread.option ? { option: thread.option } : {})
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

async function referenceImage(context: RunContext, draft: DesignDraft, directory: string) {
	if (!draft.revises) return null;
	const reference = join(directory, 'reference.png');
	await writeFile(
		reference,
		await context.planning.image({
			entityId: draft.entityId,
			version: draft.revises.version,
			sha256: draft.revises.imageSha256,
			revision: context.revision.commit,
			option: draft.revises.option
		})
	);
	return reference;
}

async function generated(context: RunContext, ask: Ask, detail: string) {
	context.emit({ runId: context.id, kind: 'status', phase: 'generating', detail });
	return context.generator.generateImage({
		cwd: ask.directory,
		prompt: ask.prompt,
		reference: ask.reference,
		model: context.imageModel,
		signal: context.signal,
		onStatus: (status) =>
			context.emit({ runId: context.id, kind: 'status', phase: 'generating', detail: status })
	});
}

async function generatedBytes(context: RunContext, draft: DesignDraft, directory: string) {
	const reference = await referenceImage(context, draft, directory);
	const proposal = draft.prompt;
	draft.prompt = designPrompt(context, proposal);
	const ask = { prompt: draft.prompt, reference, directory };
	const result = await generated(context, ask, 'Generating the design with GPT Image');
	draft.notes = imageNotes(context, result.revisedPrompt, proposal);
	return result.bytes;
}

/** Each option is generated apart, from its own direction; nothing is kept if one fails or stops. */
async function generatedOptions(
	context: RunContext,
	draft: DesignDraft,
	directory: string,
	count: number
) {
	const reference = await referenceImage(context, draft, directory);
	const proposal = draft.prompt;
	draft.prompt = designPrompt(context, proposal);
	draft.options = [];
	for (const [at, direction] of designDirections(count).entries()) {
		const prompt = `${draft.prompt}\nDesign option ${at + 1} of ${count}: ${direction}`;
		const detail = `Generating design option ${at + 1} of ${count} with GPT Image`;
		const result = await generated(context, { prompt, reference, directory }, detail);
		if (context.signal.aborted) throw new RunCancelled();
		draft.options.push({
			direction,
			bytes: result.bytes,
			prompt,
			revisedPrompt: result.revisedPrompt
		});
	}
	draft.notes = imageNotes(context, null, proposal);
}

export async function planDesign(context: RunContext, prompt: string) {
	const draft = draftFor(context, prompt),
		directory = await mkdtemp(join(tmpdir(), 'harness-design-'));
	const count = draft.notes === undefined ? designCount(context.request) : 0;
	try {
		if (count === 1) draft.bytes = await generatedBytes(context, draft, directory);
		if (count > 1) await generatedOptions(context, draft, directory, count);
		if (context.signal.aborted) throw new RunCancelled();
		await context.session.atBranch(context.revision.branch);
		context.emit({
			runId: context.id,
			kind: 'status',
			phase: 'saving',
			detail:
				count > 1
					? `Committing ${count} design options as one version`
					: 'Committing an immutable design version'
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
