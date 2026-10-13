import { RunCancelled } from '../models/AgentRunner.types';
import type { CreatedEntity, RunRequest } from '../models/DesktopBridge.types';
import type { RunContext } from '../models/RunContext.types';
import { hostChanges } from '../utils/hostChanges';
import { planDesign } from '../utils/planDesign';
import type { ProjectRunContext } from '../utils/prepareProjectRun';
import { imageModel, messageFor, recordRunFailure } from '../utils/prepareRun';
import { projectProposal, proposalPrompt, type ProjectProposal } from '../utils/projectProposal';
import { sourceChanges } from '../utils/sourceChanges';
import { sourceSnapshot, type SourceSnapshot } from '../utils/sourceSnapshot';

/** The draft a run had written when it failed or was cancelled, by the error it ended with. */
export const plannedBefore = new WeakMap<object, CreatedEntity>();
const unanchored = { version: null, imageSha256: null, state: null, viewport: null, region: null };
/** What a creation run has written so far: the draft it names, and the run of its thread. */
interface Progress {
	created: CreatedEntity | null;
	thread: Omit<RunContext, 'entity'> | null;
}
type Host = ReturnType<typeof hostChanges>;

/**
 * A creation run: the chosen agent is asked once, read-only, what the new unit is. Only a
 * proposal that was checked becomes a plan, with the request as the first message of its thread
 * and the proposal as its first design version. Nothing is said to be built or verified, and
 * a draft that was written before a failure is named, never removed.
 */
export class ProjectRunService {
	async run(context: ProjectRunContext): Promise<{ summary: string; created: CreatedEntity }> {
		const proposal = await this.proposed(context);
		// A page or a component is planned as an image: without that capability nothing is made.
		const image = await imageModel(context.preparation, context.request, proposal.category);
		await this.current(context);
		const progress: Progress = { created: null, thread: null };
		try {
			const planned = await this.planned(context, { proposal, image }, progress);
			const saved = await planDesign(planned, proposal.proposal);
			return { summary: `Planned ${proposal.title}. ${saved}`, created: progress.created! };
		} catch (error) {
			if (progress.thread && progress.created?.requestSaved)
				await recordRunFailure(progress.thread, error).catch(() => {
					/* A branch that changed must not be written to. */
				});
			if (progress.created && error instanceof Error)
				plannedBefore.set(error, { ...progress.created });
			throw error;
		}
	}

	/** Nothing is planned for a run that was cancelled, or on a branch or a commit that moved. */
	private async current(context: ProjectRunContext): Promise<void> {
		if (context.signal.aborted) throw new RunCancelled();
		const { branch, commit } = context.revision;
		const { source } = await context.session.atBranch(branch);
		if ((await source.revision({ branch, commit: null })).commit !== commit)
			throw new Error('The source revision advanced during this run; nothing was planned.');
	}

	/** The one read-only question, and its answer once it was checked. */
	private async proposed(context: ProjectRunContext): Promise<ProjectProposal> {
		const { request, runner, signal, emit, id, root } = context;
		const detail = `Asking ${request.provider} / ${request.model} what to plan`;
		emit({ runId: id, kind: 'status', phase: 'prompting', detail });
		const [before, host] = [await sourceSnapshot(root), hostChanges(root)];
		const asked = runner.run({
			...{ model: request.model, effort: request.effort, cwd: root, signal },
			prompt: proposalPrompt(request),
			access: 'read-only',
			onText: () => {},
			onStatus: () => {},
			onFile: host.observe
		});
		const answer = await asked.then(
			(result) => ({ result }),
			(failure: unknown) => ({ failure })
		);
		// Whatever came of the question, what the agent wrote although asked not to is said.
		const written = await this.written(context, before, host);
		if ('failure' in answer) throw this.failed(context, answer.failure, written);
		if (signal.aborted) throw new RunCancelled();
		if (written) throw new Error(written);
		return projectProposal(answer.result.text);
	}

	/** A cancellation stays one; any other failure also says what the agent wrote. */
	private failed(context: ProjectRunContext, failure: unknown, written: string): unknown {
		if (failure instanceof RunCancelled || context.signal.aborted || !written) return failure;
		const said = failure instanceof Error ? failure.message : 'The agent failed.';
		return new Error(`${said} ${written}`);
	}

	/**
	 * The project files that differ after the question, and the files outside the project the CLI
	 * said it wrote. Project files are told as a public event; nothing is undone. Only what the
	 * CLI reported is known of the rest of the computer.
	 */
	private async written(context: ProjectRunContext, before: SourceSnapshot, host: Host) {
		const files = sourceChanges(before, await sourceSnapshot(context.root));
		const outside = await host.record(context.id);
		if (files.length) context.emit({ runId: context.id, kind: 'changes', files });
		if (!files.length && !outside.length) return '';
		const seen = (hash: string | null) => (hash ? `sha256 ${hash.slice(0, 12)}` : 'no bytes');
		const paths = [
			...files.map((file) => file.path),
			...outside.map((file) => `${file.path} (reported by the CLI, ${seen(file.after)})`)
		];
		const named = paths.slice(0, 8).join(', ') + (paths.length > 8 ? ', …' : '');
		return `The Plan agent changed files. The changes remain recoverable; nothing was planned: ${named}.`;
	}

	/** The plan, its thread and the request as it was written, as a run of that entity. */
	private async planned(
		context: ProjectRunContext,
		made: { proposal: ProjectProposal; image: string },
		progress: Progress
	): Promise<RunContext> {
		const { project, request, emit, id } = context;
		const { category, title, goal, contract } = made.proposal;
		emit({ runId: id, kind: 'status', phase: 'saving', detail: `Planning ${title}` });
		const plan = await project.planning.createPlan({ category, title, goal, contract });
		const created: CreatedEntity = {
			category,
			entityId: plan.id,
			threadId: null,
			requestSaved: false
		};
		progress.created = created;
		const thread = await project.planning.openThread({ entityId: plan.id, ...unanchored });
		created.threadId = thread.id;
		const { provider, model, effort, text, projectId } = request;
		const scoped: RunRequest = {
			...{ projectId, mode: 'plan', provider, model, effort, text, approval: null },
			entityId: plan.id,
			threadId: thread.id
		};
		const draft = { ...context, request: scoped, imageModel: made.image };
		progress.thread = draft;
		await project.planning.appendMessage(messageFor(draft, 'user', text));
		created.requestSaved = true;
		const tip = { branch: context.revision.branch, commit: null };
		const revision = await project.source.revision(tip);
		return { ...draft, revision, entity: await project.catalog.entity(plan.id, revision.commit) };
	}
}
