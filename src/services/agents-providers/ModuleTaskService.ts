// @harness-uid u_rmurdehorf
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { UnitRegistryRepository } from '../../repositories/verification-evidence/UnitRegistryRepository';
import {
	ModuleTaskRepository,
	featureSchema,
	taskInputSchema
} from '../../repositories/agents-providers/ModuleTaskRepository';
import type {
	ModuleTask,
	TaskFeature
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../utils/development-tooling/stableJson';
import { moduleTaskPrompt, taskSelection } from './module-task-service/taskPrompt';
import { z } from 'zod';
import { retryableTask } from './module-task-service/retryableTask';
import { reviewModuleTask } from './module-task-service/reviewModuleTask';
import { queuedTask } from './module-task-service/queuedTask';
import { ModuleTaskAnalyticsService } from './ModuleTaskAnalyticsService';
/** Admit immutable feature context and wanted contracts before work is eligible for pickup. */
export class ModuleTaskService {
	readonly repository: ModuleTaskRepository;
	constructor(private readonly root = process.cwd()) {
		this.repository = new ModuleTaskRepository(root);
	}
	async feature(input: TaskFeature) {
		const feature = featureSchema.parse(input);
		return this.repository.update((queue) => {
			const old = queue.features.find((f) => f.id === feature.id);
			if (old && stableJson(old) !== stableJson(feature))
				throw new ExpectedCliError('Feature context is immutable; use a new feature id.');
			if (!old) queue.features.push(feature);
			return feature;
		});
	}
	async add(input: unknown) {
		const parsed = taskInputSchema.parse(input);
		taskSelection(parsed);
		const tree = await CommitTreeAdapter.open(this.root, 'HEAD');
		const units = await new UnitRegistryRepository(this.root).read(tree);
		const unit = units.manifests.find((u) => u.id === parsed.module && u.status === 'active');
		if (!unit?.owns.source.length)
			throw new ExpectedCliError(
				'Task module must be active and registered at the committed source revision.'
			);
		if (unit.responsibilityOrigin === 'derived' && !parsed.moduleGoal)
			throw new ExpectedCliError(
				'This module has only a generated placeholder goal; supply moduleGoal.'
			);
		const recorded = await this.repository.update((queue) => {
			if (queue.tasks.some((t) => t.id === parsed.id))
				throw new ExpectedCliError('Task id already exists; wanted contracts are immutable.');
			const feature = queue.features.find((f) => f.id === parsed.feature);
			if (!feature)
				throw new ExpectedCliError(
					'Commit the shared feature goal and TLDR with task feature first.'
				);
			const task = queuedTask(parsed, feature, unit, tree.revision);
			queue.tasks.push(task);
			return task;
		}, tree.revision);
		return { task: recorded.value, commit: recorded.commit };
	}
	async list() {
		const snapshot = await this.repository.read();
		return {
			features: snapshot.data.features,
			tasks: snapshot.data.tasks,
			commit: snapshot.commit
		};
	}
	schema(): Record<string, unknown> {
		return z.toJSONSchema(taskInputSchema);
	}
	async show(id: string) {
		const { tasks, commit } = await this.list(),
			task = tasks.find((t) => t.id === id);
		if (!task) throw new ExpectedCliError(`Task ${id} does not exist.`);
		return { task, commit };
	}
	async prompt(id: string) {
		const { task, commit } = await this.show(id);
		return this.prepare(task, commit!).prompt;
	}
	prepare(task: ModuleTask, commit: string) {
		return { prompt: moduleTaskPrompt(task, commit), selection: taskSelection(task) };
	}
	async retry(id: string) {
		const owner = await this.repository.owner();
		const result = await this.repository.update((queue) =>
			recoverTask(
				queue.tasks.find((t) => t.id === id),
				owner.workspace
			)
		);
		await new ModuleTaskAnalyticsService().sync(this.root);
		return result;
	}
	review(id: string, input: unknown) {
		return reviewModuleTask(this.root, this.repository, id, input);
	}
}

function recoverTask(task: ModuleTask | undefined, workspace: string): ModuleTask {
	if (!task || !retryableTask(task, workspace))
		throw new ExpectedCliError(
			'Task cannot be retried while its owner is active, unknown or in another clone.'
		);
	if (task.result) task.attempts.push(task.result);
	if (task.claim) {
		const recoveredAt = task.status === 'running' ? new Date().toISOString() : undefined;
		task.claimHistory.push({ ...task.claim, recoveredAt });
	}
	delete task.result;
	delete task.claim;
	task.status = 'queued';
	return task;
}
