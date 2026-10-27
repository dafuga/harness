import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { ModuleTaskDependencyBaseAdapter } from '../../adapters/agents-providers/ModuleTaskDependencyBaseAdapter';
import type { ApprovedTaskScope } from '../../helpers/agents-providers/moduleTaskApprovedSubmission.types';
import { executeClaimedTask } from '../../helpers/agents-providers/moduleTaskExecution';
import { ModuleTaskAnalyticsService } from './ModuleTaskAnalyticsService';
import { ModuleTaskContractContextService } from './ModuleTaskContractContextService';
import type {
	ModuleTask,
	TaskRunner
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { ModuleTaskService } from './ModuleTaskService';
import {
	approvedClaimQueue,
	claimedTask,
	finishTask
} from './module-task-worker-service/taskClaim';
/** Foreground workers claim atomically in a shared Git repository and preserve isolated review work. */
export class ModuleTaskWorkerService {
	private readonly repository: ModuleTaskRepository;
	constructor(
		private readonly root = process.cwd(),
		private readonly runner: TaskRunner = new ModuleTaskRunnerAdapter(),
		private readonly contexts: Pick<
			ModuleTaskContractContextService,
			'create'
		> = new ModuleTaskContractContextService(root),
		private readonly dependencyBase: Pick<
			ModuleTaskDependencyBaseAdapter,
			'resolve'
		> = new ModuleTaskDependencyBaseAdapter(root)
	) {
		this.repository = new ModuleTaskRepository(root);
	}
	async once(worker: string, modules: string[] = [], signal = AbortSignal.timeout(900000)) {
		return this.claim(worker, { modules, signal });
	}
	async onceApproved(
		worker: string,
		scope: ApprovedTaskScope,
		signal = AbortSignal.timeout(900000)
	) {
		return this.claim(worker, { modules: [], signal, scope: structuredClone(scope) });
	}
	private async claim(
		worker: string,
		options: { modules: string[]; signal: AbortSignal; scope?: ApprovedTaskScope }
	) {
		const { modules, signal, scope } = options;
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(worker))
			throw new Error('Worker must be a lowercase dotted or dashed identifier.');
		signal.throwIfAborted();
		await this.runner.ready?.();
		signal.throwIfAborted();
		const owner = await this.repository.owner();
		signal.throwIfAborted();
		const service = new ModuleTaskService(this.root);
		let prepared: ReturnType<ModuleTaskService['prepare']> | undefined;
		let checkpoints: string[] = [];
		const claim = await this.repository.update((queue) => {
			signal.throwIfAborted();
			const eligible = scope ? approvedClaimQueue(queue, scope) : queue;
			return claimedTask(eligible, worker, modules, owner, (task, acceptedCheckpoints) => {
				checkpoints = [...acceptedCheckpoints];
				const candidate = service.prepare(task, task.sourceCommit);
				prepared = {
					...candidate,
					selection: { ...candidate.selection },
					files: [...candidate.files]
				};
			});
		});
		if (!claim.value) return { status: 'idle' as const };
		return this.execute(claim.value, claim.commit!, signal, { preflight: prepared!, checkpoints });
	}
	private async execute(
		task: ModuleTask,
		commit: string,
		signal: AbortSignal,
		prepared: { preflight: ReturnType<ModuleTaskService['prepare']>; checkpoints: string[] }
	) {
		const result = await executeClaimedTask({
			root: this.root,
			task,
			commit,
			signal,
			...prepared,
			runner: this.runner,
			contexts: this.contexts,
			dependencyBase: this.dependencyBase
		});
		await this.repository.update(
			(queue) => finishTask(queue, task, result),
			result.checkpointCommit
		);
		await new ModuleTaskAnalyticsService().sync(this.root);
		return {
			status: result.error ? ('failed' as const) : ('review' as const),
			task: task.id,
			result
		};
	}
}
