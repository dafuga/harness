import type { RunEvent, RunRequest } from '../models/DesktopBridge.types';
import type { RunContext } from '../models/RunContext.types';
import type { ImageGenerator } from '../models/AgentRunner.types';
import { RunCancelled } from '../models/AgentRunner.types';
import type { ProjectSessionService } from './ProjectSessionService';
import type { ProviderDiscoveryService } from './ProviderDiscoveryService';
import { PlanRunService } from './PlanRunService';
import { ChangeRunService } from './ChangeRunService';
import { prepareRun, recordRunFailure } from '../utils/prepareRun';
/** The runs of one client. Its events and its cancel belong to that client alone. */
export class DesktopRunService {
	private active: { id: string; controller: AbortController } | null = null;
	constructor(
		private session: ProjectSessionService,
		private providers: ProviderDiscoveryService,
		private generator: ImageGenerator,
		private emit: (event: RunEvent) => void
	) {}
	async start(request: RunRequest): Promise<{ runId: string }> {
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
	private prepared(request: RunRequest, controller: AbortController): Promise<RunContext> {
		const { session, providers, generator, emit } = this;
		const prepare = () => prepareRun({ session, providers, generator, emit }, request, controller);
		return session.root === null ? prepare() : session.arbiter.exclusive(session.root, prepare);
	}
	private async execute(context: RunContext): Promise<void> {
		try {
			this.emit({
				runId: context.id,
				kind: 'status',
				phase: 'queued',
				detail: 'Starting ' + context.request.mode
			});
			const summary = await (
				context.request.mode === 'plan' ? new PlanRunService() : new ChangeRunService()
			).run(context);
			this.emit({ runId: context.id, kind: 'finished', summary, verified: false });
		} catch (error) {
			await recordRunFailure(context, error).catch(() => {
				/* A branch/ref conflict must not write to a different branch. */
			});
			if (error instanceof RunCancelled) this.emit({ runId: context.id, kind: 'cancelled' });
			else
				this.emit({
					runId: context.id,
					kind: 'failed',
					message: error instanceof Error ? error.message : 'Run failed.'
				});
		} finally {
			this.release(context.root);
		}
	}
}
