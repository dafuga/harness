import type { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import type {
	FeaturePlan,
	ModuleTask
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { FeatureWorkSnapshot, FeatureWorkTask } from './FeatureWorkService.types';

export type { FeatureWorkSnapshot, FeatureWorkTask } from './FeatureWorkService.types';

export class FeatureWorkService {
	constructor(private readonly repository?: Pick<ModuleTaskRepository, 'read'>) {}

	run(): string {
		return 'feature-work';
	}

	async read(): Promise<FeatureWorkSnapshot> {
		if (!this.repository) throw new Error('Feature work requires a project task repository.');
		const { commit, data } = await this.repository.read();
		const plans = new Map<string, FeaturePlan>();
		const tasks = new Map<string, ModuleTask[]>();
		for (const plan of data.plans ?? []) {
			const previous = plans.get(plan.feature);
			if (!previous || plan.revision > previous.revision) plans.set(plan.feature, plan);
		}
		for (const task of data.tasks) {
			const group = tasks.get(task.feature.id) ?? [];
			group.push(task);
			tasks.set(task.feature.id, group);
		}
		return {
			queueCommit: commit ?? null,
			features: data.features.map(({ id, goal, tldr }) => {
				const plan = plans.get(id);
				return {
					id,
					goal,
					tldr,
					plan: plan ? structuredClone(plan) : null,
					tasks: this.projectTasks(tasks.get(id) ?? [], plan)
				};
			})
		};
	}

	private projectTasks(tasks: ModuleTask[], plan?: FeaturePlan): FeatureWorkTask[] {
		const statuses = new Map(tasks.map((task) => [task.id, task.status]));
		const planned = new Set(plan?.tasks.map((task) => task.id) ?? []);
		return tasks.map((task) => {
			const dependsOn = [...(task.dependsOn ?? [])];
			return {
				id: task.id,
				title: task.title,
				module: task.module.id,
				status: task.status,
				dependsOn,
				blockedBy: dependsOn.filter((id) => statuses.get(id) !== 'accepted'),
				belongsToPlan: planned.has(task.id)
			};
		});
	}
}
