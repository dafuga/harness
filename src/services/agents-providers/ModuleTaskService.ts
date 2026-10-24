import { createHash } from 'node:crypto';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
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
				throw new Error('Feature context is immutable; use a new feature id.');
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
			throw new Error(
				'Task module must be active and registered at the committed source revision.'
			);
		const recorded = await this.repository.update((queue) => {
			if (queue.tasks.some((t) => t.id === parsed.id))
				throw new Error('Task id already exists; wanted contracts are immutable.');
			const feature = queue.features.find((f) => f.id === parsed.feature);
			if (!feature)
				throw new Error('Commit the shared feature goal and TLDR with task feature first.');
			const task: ModuleTask = {
				...parsed,
				feature,
				module: { id: unit.id, goal: unit.responsibility, files: unit.owns.source },
				sourceCommit: tree.revision,
				contractHash: createHash('sha256').update(stableJson(parsed.wantedContract)).digest('hex'),
				status: 'queued',
				createdAt: new Date().toISOString(),
				attempts: []
			};
			queue.tasks.push(task);
			return task;
		}, tree.revision);
		return { task: recorded.value, commit: recorded.commit };
	}
	async list() {
		const snapshot = await this.repository.read();
		return { features:snapshot.data.features,tasks: snapshot.data.tasks, commit: snapshot.commit };
	}
	schema() {return z.toJSONSchema(taskInputSchema);}
	async show(id: string) {
		const { tasks, commit } = await this.list(),
			task = tasks.find((t) => t.id === id);
		if (!task) throw new Error(`Task ${id} does not exist.`);
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
		return this.repository.update((queue) => {
			const task = queue.tasks.find((t) => t.id === id);
			if (!task || task.status !== 'failed')
				throw new Error('Only failed tasks may be retried; running claims are never stolen.');
			if (task.result) task.attempts.push(task.result);
			delete task.result;
			delete task.claim;
			task.status = 'queued';
			return task;
		});
	}
}
