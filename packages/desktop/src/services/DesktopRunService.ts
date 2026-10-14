import type { ProjectRunRequest, RunEvent, RunRequest } from '../models/DesktopBridge.types';
import { designCount } from '../utils/designCount';
import type { RunContext } from '../models/RunContext.types';
import type { ImageGenerator } from '../models/AgentRunner.types';
import { RunCancelled } from '../models/AgentRunner.types';
import type { ProjectSessionService } from './ProjectSessionService';
import type { ProviderDiscoveryService } from './ProviderDiscoveryService';
import { PlanRunService } from './PlanRunService';
import { ChangeRunService } from './ChangeRunService';
import { plannedBefore, ProjectRunService } from './ProjectRunService';
import { prepareProjectRun, type ProjectRunContext } from '../utils/prepareProjectRun';
import { prepareRun, recordRunFailure } from '../utils/prepareRun';
type Prepared = RunContext | ProjectRunContext;
/** A creation run has no entity yet: it is told apart by what it was asked, not by a guess. */
function creates(context: Prepared): context is ProjectRunContext {
	return 'intent' in context.request;
}
/** The runs of one client. Its events and its cancel belong to that client alone. */
export class DesktopRunService {
	private active: { id: string; controller: AbortController } | null = null;
	constructor(
		private session: ProjectSessionService,
		private providers: ProviderDiscoveryService,
		private generator: ImageGenerator,
		private emit: (event: RunEvent) => void
	) {}
	async start(request: RunRequest | ProjectRunRequest): Promise<{ runId: string }> {
		designCount(request);
		const root = this.session.root;
		if (this.session.busy || !this.claim(root))
			throw new Error('A run is already active in this project.');
		this.session.busy = true;
		try {
			const controller = new AbortController();
			this.active = { id: '', controller };
			const context = await this.prepared(request, controller);
			this.active = { id: context.id, controller };
			setTimeout(() => {
				void this.execute(context);
			}, 0);
			return { runId: context.id };
		} catch (error) {
			this.release(root);
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
	private release(root: string | null): void {
		this.active = null;
		this.session.busy = false;
		if (root !== null) this.session.arbiter.release(root, this);
	}
	/** The first write of a run waits for a planning write another client still has in flight. */
	private prepared(
		request: RunRequest | ProjectRunRequest,
		controller: AbortController
	): Promise<Prepared> {
		const { session, providers, generator, emit } = this;
		const given = { session, providers, generator, emit };
		const prepare = (): Promise<Prepared> =>
			'intent' in request
				? prepareProjectRun(given, request, controller)
				: prepareRun(given, request, controller);
		return session.root === null ? prepare() : session.arbiter.exclusive(session.root, prepare);
	}
	/** What a run came to. A new plan also names itself, so that what asked for it can open it. */
	private async outcome(context: Prepared) {
		if (creates(context)) return new ProjectRunService().run(context);
		const service = context.request.mode === 'plan' ? new PlanRunService() : new ChangeRunService();
		return { summary: await service.run(context) };
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
			if (!creates(context))
				await recordRunFailure(context, error).catch(() => {
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
			this.release(context.root);
		}
	}
}
