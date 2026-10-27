import type { Prepared } from './DesktopRunService.types';
import type {
	ProjectRunRequest,
	ProjectTaskRequest,
	FeaturePlanPreparationRequest,
	RunEvent,
	RunRequest
} from '../../../models/development-tooling/DesktopBridge.types';
import type { FeaturePlan } from '../../../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { FeaturePlanRepository } from '../../../../../../src/repositories/agents-providers/FeaturePlanRepository';
import { FeaturePlanService } from '../../../../../../src/services/agents-providers/FeaturePlanService';
import { FeaturePlanPreparationService } from '../../../../../../src/services/agents-providers/FeaturePlanPreparationService';
import { ModuleDataService } from '../../../../../../src/services/git-source-history/ModuleDataService';
import { FeaturePlanCoverageValidator } from '../../../../../../src/validators/agents-providers/FeaturePlanCoverageValidator';
import { FeaturePlanValidator } from '../../../../../../src/validators/agents-providers/FeaturePlanValidator';
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
import { FeaturePlanPreparationHostService } from '../FeaturePlanPreparationHostService';
import { ProjectImageCacheService } from '../../../lib/development-tooling/desktop-bridge/ProjectImageCacheService';
import { gitRevision } from '../../../utils/projects-sessions/gitRead';
import { createHash } from 'node:crypto';

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
	async prepareFeaturePlan(input: FeaturePlanPreparationRequest): Promise<FeaturePlan> {
		const { session } = this,
			root = session.root;
		session.assertProject(input.projectId);
		if (!root || session.busy || !this.claim(root))
			throw new Error('A project operation is already active.');
		session.busy = true;
		const controller = new AbortController();
		this.active = { id: `feature-plan:${input.proposal.feature}`, controller };
		try {
			this.lease = await repositoryLease(root);
			if (!this.lease) throw new Error('A planning write is active in another Harness app.');
			this.lease.signal.addEventListener('abort', () => controller.abort(), { once: true });
			controller.signal.throwIfAborted();
			const project = await session.mutable();
			if (
				project.revision.commit !== input.sourceCommit ||
				input.proposal.sourceCommit !== input.sourceCommit
			)
				throw new Error('Feature plan source must match the writable project revision.');
			const data = await new ModuleDataService(root).require(input.sourceCommit),
				coverage = new FeaturePlanCoverageValidator(),
				repository = new FeaturePlanRepository(root),
				planService = new FeaturePlanService({ repository, validator: new FeaturePlanValidator() });
			const host = new FeaturePlanPreparationHostService({
				generator: this.generator,
				planning: project.planning,
				revision: () => gitRevision(root),
				data: (commit) => new ModuleDataService(root).require(commit)
			});
			const preparation = new FeaturePlanPreparationService({
				discover: (proposal, metadata) => coverage.discover(proposal, metadata),
				preparePage: async (page) => {
					const bytes = await new ProjectImageCacheService(session).read({
						projectId: input.projectId,
						entityId: page.module,
						commit: page.reference.commit,
						version: page.reference.version,
						sha256: page.reference.sha256,
						...(page.reference.option ? { option: page.reference.option } : {})
					});
					if (createHash('sha256').update(bytes).digest('hex') !== page.reference.sha256)
						throw new Error(`The exact design reference hash changed for ${page.module}.`);
					return host.preparePage({ ...page, referenceBytes: bytes });
				},
				admit: (action) => action(),
				finalize: (value, signal) => host.finalize(value, signal),
				verify: (plan, metadata) => coverage.validate(plan, metadata),
				draft: (plan) => planService.draft(plan)
			});
			const plan = await preparation.prepare({
				proposal: input.proposal,
				data,
				originalRequest: input.originalRequest,
				pageDesigns: input.pageDesigns,
				signal: controller.signal
			});
			session.assertProject(input.projectId);
			if (session.root !== root)
				throw new Error('The selected project changed during feature preparation.');
			return plan;
		} finally {
			await this.release(root);
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
