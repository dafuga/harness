import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { ModuleTaskDependencyBaseAdapter } from '../../adapters/agents-providers/ModuleTaskDependencyBaseAdapter';
import { executeClaimedTask } from '../../helpers/agents-providers/moduleTaskExecution';
import { ModuleTaskAnalyticsService } from './ModuleTaskAnalyticsService';
import { ModuleTaskContractContextService } from './ModuleTaskContractContextService';
import type {
	ModuleTask,
	TaskRunner
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { ModuleTaskService } from './ModuleTaskService';
import { claimedTask, finishTask } from './module-task-worker-service/taskClaim';
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
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(worker))
			throw new Error('Worker must be a lowercase dotted or dashed identifier.');
		signal.throwIfAborted();
		const owner = await this.repository.owner();
		signal.throwIfAborted();
		const service = new ModuleTaskService(this.root);
		let prepared: ReturnType<ModuleTaskService['prepare']> | undefined;
		let checkpoints: string[] = [];
		const claim = await this.repository.update((queue) => {
			signal.throwIfAborted();
			return claimedTask(queue, worker, modules, owner, (task, acceptedCheckpoints) => {
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
		return this.execute(claim.value, claim.commit!, signal, prepared!, checkpoints);
	}
	private async execute(
		task: ModuleTask,
		commit: string,
		signal: AbortSignal,
		preflight: ReturnType<ModuleTaskService['prepare']>,
		checkpoints: string[]
	) {
		const result = await executeClaimedTask({
			root: this.root,
			task,
			commit,
			signal,
			preflight,
			checkpoints,
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
