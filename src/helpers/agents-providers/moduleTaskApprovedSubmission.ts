import {
	featureSchema,
	taskInputSchema
} from '../../repositories/agents-providers/ModuleTaskRepository';
import { isDeepStrictEqual } from 'node:util';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type {
	ModuleTask,
	ModuleTaskInput,
	ModuleTaskQueue,
	TaskFeature
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskService } from '../../services/agents-providers/ModuleTaskService';
import { queuedTask } from '../../services/agents-providers/module-task-service/queuedTask';
import type { SubmissionDependencies } from './moduleTaskApprovedSubmission.types';
export type { SubmissionDependencies } from './moduleTaskApprovedSubmission.types';

/** @pure */
export function moduleTaskApprovedSubmission(textToFormat: string): string {
	if (typeof textToFormat !== 'string')
		throw new TypeError('moduleTaskApprovedSubmission expects text');
	return textToFormat.trim();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const safePath = (value: unknown): value is string =>
	typeof value === 'string' &&
	value.length > 0 &&
	!value.startsWith('/') &&
	!value.includes('\\') &&
	!value.split('/').includes('..');

const parsePlan = (value: unknown): { feature: TaskFeature; tasks: ModuleTaskInput[] } => {
	if (!isRecord(value) || !Array.isArray(value.tasks)) throw new Error('Invalid module task plan');
	const feature = featureSchema.parse(value.feature);
	const tasks = value.tasks.map((item) => taskInputSchema.parse(item));
	const ids = new Set<string>();
	for (const task of tasks) {
		if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
		if (task.feature !== feature.id) throw new Error(`Task ${task.id} names another feature`);
		ids.add(task.id);
	}
	return { feature, tasks };
};

const validateModule = (
	manifest: ComponentManifest,
	task: ModuleTaskInput
): { task: ModuleTaskInput; files: string[] } => {
	if (manifest.status !== 'active') throw new Error(`Module ${task.module} is not active`);
	const sources = manifest.owns?.source;
	if (!Array.isArray(sources) || !sources.length || !sources.every(safePath))
		throw new Error(`Module ${task.module} has no safe owned source scope`);
	const moduleGoal = manifest.responsibility;
	if (typeof moduleGoal !== 'string' || !moduleGoal.trim())
		throw new Error(`Module ${task.module} has no committed responsibility`);
	const { inputs, outputs, errors } = manifest.contract;
	const moduleContract = { inputs, outputs, errors, responsibility: moduleGoal };
	const admittedTask = { ...task, moduleGoal };
	taskInputSchema.parse({ ...admittedTask, wantedContract: moduleContract });
	return { task: admittedTask, files: sources };
};

const sameFeature = (left: TaskFeature, right: TaskFeature) =>
	JSON.stringify(left) === JSON.stringify(right);
const taskDefinitionKeys = (
	'id title feature module moduleGoal verificationFiles assignedFiles role instructions ' +
	'wantedContract model provider intelligence assignee sourceCommit contractHash dependsOn'
).split(' ') as Array<keyof ModuleTask>;
export const sameTask = (left: ModuleTask, right: ModuleTask) =>
	taskDefinitionKeys.every((key) => isDeepStrictEqual(left[key], right[key]));

const existingTask = (queue: ModuleTaskQueue, task: ModuleTask) => {
	const matches = queue.tasks.filter((item) => item.id === task.id);
	if (matches.length > 1 || (matches[0] && !sameTask(matches[0], task)))
		throw new Error(`Conflicting task: ${task.id}`);
	return matches.length > 0;
};

export const mergePlan = (
	queue: ModuleTaskQueue,
	feature: TaskFeature,
	tasks: ModuleTask[]
): { created: string[]; reused: string[] } => {
	const features = queue.features.filter((item) => item.id === feature.id);
	if (features.length > 1 || (features[0] && !sameFeature(features[0], feature)))
		throw new Error(`Conflicting feature: ${feature.id}`);
	const created: string[] = [],
		reused: string[] = [],
		additions: ModuleTask[] = [];
	for (const task of tasks) {
		const exists = existingTask(queue, task);
		(exists ? reused : created).push(task.id);
		if (!exists) additions.push(task);
	}
	if (!features.length) queue.features.push(feature);
	queue.tasks.push(...additions);
	return { created, reused };
};

export async function prepareSubmission(
	input: unknown,
	dependencies: SubmissionDependencies,
	expectedSource?: string
) {
	const { feature, tasks } = parsePlan(input);
	const tree = await dependencies.openTree(dependencies.root, 'HEAD');
	if (expectedSource && tree.revision !== expectedSource)
		throw new Error('Approved plan source is no longer current.');
	const registry = await dependencies.registry.read(tree);
	if (registry.errors.length) throw new Error('Selected unit registry contains invalid manifests');
	const units = new Map<string, ComponentManifest>();
	const admissions: Array<{ task: ModuleTaskInput; unit: ComponentManifest; files: string[] }> = [];
	for (const task of tasks) {
		const manifest = registry.manifests.find((item) => item.id === task.module);
		if (!manifest) throw new Error(`Module ${task.module} is not registered`);
		const validated = validateModule(manifest, task);
		units.set(task.module, manifest);
		const files = await dependencies.grantFiles(validated.task, manifest, tree);
		await dependencies.validateGrant(dependencies.root, files);
		admissions.push({ task: validated.task, unit: manifest, files });
	}
	for (const module of units.keys())
		await dependencies.requireMetadata(dependencies.root, tree.revision, module);
	const queue = await dependencies.repository.read();
	const service = new ModuleTaskService(dependencies.root);
	const records = admissions.map(({ task, unit, files }) =>
		queuedTask(task, feature, unit, tree.revision, files)
	);
	for (const record of records) service.prepare(record, queue.commit ?? tree.revision);
	return { feature, records, sourceCommit: tree.revision };
}
