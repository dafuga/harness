import type {
	ProjectRunRequest,
	ProjectTaskRequest,
	RunEvent,
	RunRequest
} from '../../../models/development-tooling/DesktopBridge.types';
import {
	repositoryLease,
	type RepositoryLease
} from '../../../utils/development-tooling/repositoryLease';
import { designCount } from '../../../utils/planning-collaboration/designCount';
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import type { ImageGenerator } from '../../../models/agents-providers/AgentRunner.types';
import { RunCancelled } from '../../../models/agents-providers/AgentRunner.types';
import type { ProjectSessionService } from '../../projects-sessions/project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../provider-discovery-service/ProviderDiscoveryService';
import { PlanRunService } from './PlanRunService';
import { ChangeRunService } from './change-run-service/ChangeRunService';
import { plannedBefore, ProjectRunService } from './project-run-service/ProjectRunService';
import { prepareProjectRun } from './prepareProjectRun';
import { type ProjectRunContext } from '../../../utils/agents-providers/prepareProjectRun';
import { prepareRun } from './prepareRun';
import { recordRunFailure } from '../../../utils/agents-providers/prepareRun';
import { prepareProjectTask } from './prepareProjectTask';
import { type ProjectTaskContext } from '../../../utils/agents-providers/prepareProjectTask';
import { ProjectTaskService } from './project-task-service/ProjectTaskService';

type Prepared = RunContext | ProjectRunContext | ProjectTaskContext;

/** A creation run has no entity yet: it is told apart by what it was asked, not by a guess. */
function creates(context: Prepared): context is ProjectRunContext {
	return 'intent' in context.request && context.request.intent === 'create';
}

/** The runs of one client. Its events and its cancel belong to that client alone. */
export class DesktopRunService {
	private lease: RepositoryLease | null = null;
	private active: { id: string; controller: AbortController } | null = null;
	constructor(
		private session: ProjectSessionService,
		private providers: ProviderDiscoveryService,
		private generator: ImageGenerator,
		private emit: (event: RunEvent) => void
	) {}
	async start(
		request: RunRequest | ProjectRunRequest | ProjectTaskRequest
	): Promise<{ runId: string }> {
		designCount(request);
		const root = this.session.root;
		if (this.session.busy || !this.claim(root))
			throw new Error('A run is already active in this project.');
		this.session.busy = true;
		try {
			const controller = new AbortController();
			this.active = { id: '', controller };
			this.lease = root ? await repositoryLease(root) : null;
			this.lease?.signal.addEventListener('abort', () => controller.abort(), { once: true });
			if (this.lease?.signal.aborted) controller.abort();
			if (root && !this.lease)
				throw new Error('An agent or planning write is active in another Harness app.');
			const context = await this.prepared(request, controller);
			this.active = { id: context.id, controller };
			setTimeout(() => {
				void this.execute(context);
			}, 0);
			return { runId: context.id };
		} catch (error) {
			await this.release(root);
			throw error;
		}
	}
	cancelActive(): void {
		this.active?.controller.abort();
	}

	cancel(runId: string): boolean {
		if (this.active?.id !== runId) return false;
		this.active.controller.abort();
		return true;
	}
	/** One run per repository across every client of this computer. Cancellable while preparing. */
	private claim(root: string | null): boolean {
		return root === null || this.session.arbiter.hold(root, this);
	}
	private async release(root: string | null): Promise<void> {
		await this.lease?.();
		this.lease = null;
		this.active = null;
		this.session.busy = false;
		if (root !== null) this.session.arbiter.release(root, this);
	}
	/** The first write of a run waits for a planning write another client still has in flight. */
	private prepared(
		request: RunRequest | ProjectRunRequest | ProjectTaskRequest,
		controller: AbortController
	): Promise<Prepared> {
		const { session, providers, generator, emit } = this;
		const given = { session, providers, generator, emit };
		const prepare = (): Promise<Prepared> => {
			if (!('intent' in request)) return prepareRun(given, request, controller);
			if (request.intent === 'task') return prepareProjectTask(given, request, controller);
			return prepareProjectRun(given, request, controller);
		};
		return session.root === null ? prepare() : session.arbiter.exclusive(session.root, prepare);
	}
	/** What a run came to. A new plan also names itself, so that what asked for it can open it. */
	private async outcome(context: Prepared) {
		if (creates(context)) return new ProjectRunService().run(context);
		if ('intent' in context.request)
			return new ProjectTaskService().run(context as ProjectTaskContext);
		const service = context.request.mode === 'plan' ? new PlanRunService() : new ChangeRunService();
		return { summary: await service.run(context as RunContext) };
	}
	private async execute(context: Prepared): Promise<void> {
		try {
			this.emit({
				runId: context.id,
				kind: 'status',
				phase: 'queued',
				detail: 'Starting ' + context.request.mode
			});
			const done = await this.outcome(context);
			this.emit({ runId: context.id, kind: 'finished', ...done, verified: false });
		} catch (error) {
			// A creation that failed before its plan has no thread: it records its own failure.
			if (!('intent' in context.request))
				await recordRunFailure(context as RunContext, error).catch(() => {
					/* A branch/ref conflict must not write to a different branch. */
				});
			const created = error instanceof Error ? plannedBefore.get(error) : undefined;
			const left = created ? { created } : {};
			if (error instanceof RunCancelled)
				this.emit({ runId: context.id, kind: 'cancelled', ...left });
			else
				this.emit({
					runId: context.id,
					kind: 'failed',
					message: error instanceof Error ? error.message : 'Run failed.',
					...left
				});
		} finally {
			await this.release(context.root);
		}
	}
}
